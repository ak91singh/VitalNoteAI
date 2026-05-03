/**
 * Agentic SOAP Generation Service
 *
 * Architecture (v3 — Reflection Pattern):
 *   Stage 1: _generateSOAPInOneShot() → Agent 1 writes note [1 API call]
 *   Stage 2: HallucinationAuditor.auditSOAPNote() → Agent 2 audits [1 call]
 *   Stage 3: _rewriteWithCorrections() → Agent 1 fixes if needed [0 or 1 call]
 *            ITERATION CAP: 1 rewrite maximum. No loops permitted.
 *
 * Total API calls per session: 2 (clean note) or 3 (hallucinations found)
 *
 * Model fallback chain:
 *   Tier 1: Groq  — llama-3.3-70b-versatile  (30 RPM, 14,400 RPD free)
 *   Tier 2: Groq  — llama-3.1-8b-instant      (30 RPM, 14,400 RPD free)
 *   Tier 3: OpenRouter — meta-llama/llama-3.3-70b-instruct:free (last resort)
 *   → If all 3 fail, caller falls through to legacy HF pipeline
 */

import { CONFIG } from '../config';
import { HallucinationAuditor } from './HallucinationAuditor';
import { logGenerationEvent } from './auditLogger';

const GROQ_API_URL       = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Provider-aware tier list. Tier 1 & 2 use Groq (generous free limits).
// Tier 3 uses OpenRouter as last resort before falling through to HF.
const MODEL_TIERS = [
  {
    label:   'Groq llama-3.3-70b-versatile',
    model:   'llama-3.3-70b-versatile',
    url:     GROQ_API_URL,
    getKey:  () => CONFIG.GROQ_API_KEY,
    headers: {},                           // Groq needs no extra headers
  },
  {
    label:   'Groq llama-3.1-8b-instant',
    model:   'llama-3.1-8b-instant',
    url:     GROQ_API_URL,
    getKey:  () => CONFIG.GROQ_API_KEY,
    headers: {},
  },
  {
    label:   'OpenRouter llama-3.3-70b',
    model:   'meta-llama/llama-3.3-70b-instruct:free',
    url:     OPENROUTER_API_URL,
    getKey:  () => CONFIG.OPENROUTER_API_KEY,
    headers: { 'HTTP-Referer': 'https://vitalnoteai.app', 'X-Title': 'VitalNoteAI' },
  },
];

export const AgenticSOAPService = {
  /**
   * Generate SOAP note using the 3-stage Reflection Pattern.
   *
   * Stage 1 always runs. Stage 2 always runs (but its failure never blocks the doctor).
   * Stage 3 fires only when Stage 2 finds hallucinations — single pass, no loop.
   */
  async generateSOAP(userId, transcript, language = 'English', isMultiSpeaker = true, onProgress = null) {
    const startTime = Date.now();
    // Reset accumulators for this generation run
    this._tokenAccumulator = { promptTokens: 0, completionTokens: 0 };
    this._lastModelUsed = null;

    const progress = (stage, message) => {
      if (onProgress && typeof onProgress === 'function') {
        onProgress({ stage, message });
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 1 — Note Writing (always runs)
    // ─────────────────────────────────────────────────────────────────────────
    if (__DEV__) console.log('🤖 Stage 1: Writing SOAP note...');
    progress('extracting', 'Analysing your recording...');
    let stage1Result;
    try {
      stage1Result = await this._generateSOAPInOneShot(transcript, isMultiSpeaker, language);
    } catch (error) {
      console.error('❌ Stage 1 failed:', error);
      logGenerationEvent(userId, {
        success: false,
        language,
        isMultiSpeaker,
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }

    const stage1FormattedNote = this._formatSOAPNote(stage1Result.soap_note);
    progress('writing', 'SOAP note drafted ✅');

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 2 — Independent Audit (always runs; failure never blocks the doctor)
    // ─────────────────────────────────────────────────────────────────────────
    if (__DEV__) console.log('🔍 Stage 2: Independent audit running...');
    progress('auditing', 'Running hallucination audit...');
    let audit = null;
    let auditFailed = false;
    try {
      audit = await HallucinationAuditor.auditSOAPNote(transcript, stage1FormattedNote, isMultiSpeaker);
      if (__DEV__) {
        if (audit.hallucinations_detected === 0) {
          console.log('✅ Stage 2: Audit passed — no hallucinations');
        } else {
          console.log(`⚠️  Stage 2: ${audit.hallucinations_detected} hallucination(s) found — triggering rewrite...`);
        }
      }
      if (audit.hallucinations_detected === 0) {
        progress('audit_passed', 'Audit passed — no issues found ✅');
      } else {
        progress('rewriting', `${audit.hallucinations_detected} issue(s) found — correcting now...`);
      }
    } catch (err) {
      console.error('[Audit] Failed:', err.message);
      auditFailed = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 3 — Conditional Rewrite (only if hallucinations_detected > 0)
    // HARD LIMIT: Maximum 1 rewrite attempt per session (Reflection Pattern — single pass only).
    // Do NOT convert this into a loop. If the rewrite still contains issues,
    // Agent 2's audit report is shown to the doctor transparently.
    // A second automated rewrite pass is not permitted.
    // ─────────────────────────────────────────────────────────────────────────
    let finalFormattedNote = stage1FormattedNote;
    let rewriteTriggered = false;
    let rewriteFailed = false;

    if (!auditFailed && audit && audit.hallucinations_detected > 0) {
      rewriteTriggered = true;
      if (__DEV__) console.log('✏️  Stage 3: Rewriting with corrections...');
      try {
        const rewrite = await this._rewriteWithCorrections(
          transcript,
          stage1FormattedNote,
          audit.corrections_required,
          isMultiSpeaker,
          language
        );
        finalFormattedNote = this._formatSOAPNote(rewrite.soap_note);
      } catch (err) {
        console.error('[Rewrite] Failed:', err.message);
        rewriteFailed = true;
        // finalFormattedNote stays as Stage 1's note
      }
    }

    const elapsedTime = (Date.now() - startTime) / 1000;
    if (__DEV__) console.log(`✨ Pipeline complete in ${elapsedTime.toFixed(1)}s`);

    const { timeSavedMinutes, moneySavedUSD } = this._estimateValueSaved(
      transcript,
      rewriteTriggered ? 1 : 0,
      audit?.quality_score ?? 0.8
    );

    progress('complete', 'Your note is ready');

    const successResult = {
      success: true,
      soapNote: finalFormattedNote,
      metadata: {
        // From Agent 2 audit (or fallback values if auditFailed)
        qualityScore:             audit?.quality_score             ?? 0,
        dimensionScores:          audit?.dimension_scores          ?? {},
        hallucinationsDetected:   audit?.hallucinations_detected   ?? 0,
        misattributionsDetected:  audit?.misattributions_detected  ?? 0,
        strengths:                audit?.strengths                 ?? [],
        improvementsNeeded:       audit?.improvements_needed       ?? [],
        validationReport: {
          validation_passed:       audit?.validation_passed        ?? false,
          hallucinations_detected: audit?.hallucinations_detected  ?? 0,
          confidence_score:        audit?.confidence_score         ?? 0,
          concerns:                audit?.concerns                 ?? [],
        },
        // Rewrite tracking
        correctionsApplied: audit?.corrections_required ?? [],
        rewriteTriggered,
        revisionCount: rewriteTriggered ? 1 : 0,
        // Failure flags
        auditFailed,
        rewriteFailed,
        // From Agent 1
        medicalCodes: stage1Result.medical_codes,
        // Computed
        generationTime: elapsedTime,
        cost:           0.00,
        costSaved:      this._calculateCostSaved(this._tokenAccumulator),
        timeSavedMinutes,
        moneySavedUSD,
      }
    };

    logGenerationEvent(userId, {
      success:                true,
      modelUsed:              this._lastModelUsed,
      qualityScore:           audit?.quality_score             ?? null,
      confidenceScore:        audit?.confidence_score          ?? null,
      hallucinationsDetected: audit?.hallucinations_detected   ?? null,
      misattributionsDetected: audit?.misattributions_detected ?? null,
      generationTimeSeconds:  elapsedTime,
      language,
      isMultiSpeaker,
    });

    return successResult;
  },

  /**
   * Stage 1 — SOAP note writer (Agent 1).
   * Writes the note only. No hallucination audit, no quality scoring.
   *
   * isMultiSpeaker=true  → doctor/patient dialogue; speaker attribution required
   * isMultiSpeaker=false → single clinician narration; no speaker fields
   */
  async _generateSOAPInOneShot(transcript, isMultiSpeaker = true, language = 'English') {
    const speakerContext = isMultiSpeaker
      ? `The transcript contains a DOCTOR–PATIENT dialogue.
- Attribute every finding, symptom, and vital to the correct speaker (doctor or patient).
- The doctor's statements drive the Objective section (physical exam, measured vitals).
- The patient's statements drive the Subjective section (symptoms, complaints, history).
- Flag any data point where the speaker attribution is uncertain.`
      : `The transcript is a single CLINICIAN NARRATION (not a dialogue).
- There are no speaker attribution fields — all data comes from one narrator.
- Do NOT include any "speaker" fields in your internal reasoning.`;

    const systemPrompt = `You are an elite clinical documentation AI combining the expertise of a senior physician and a certified medical coder.

You will receive a medical consultation transcript. Reason step by step through each section before writing the final JSON. ALL clinical content must be written in English, regardless of the transcript language.

NEVER output anything except the final JSON object.
No markdown fences. No preamble. No explanation. Raw JSON only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSCRIPT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${speakerContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — CLINICAL DATA EXTRACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Extract ONLY what is explicitly stated or clearly implied. Never fabricate.

- Chief complaint: patient's own words
- Symptoms: onset, duration, severity, character
- Vitals: include ONLY if stated with an actual numeric value
  - Clinician-measured vitals (e.g. "BP is 130 over 80"): include as-is
  - Patient-reported measurements (e.g. "I checked, my fever was 101°F at home"): include labeled as "Patient-reported: [value]"
  - If no vitals are mentioned at all: omit the vitals field entirely
- Physical exam: only findings the clinician explicitly states they observed
- Medications: name, dose, frequency — only if mentioned
- Past medical history: only if discussed
- Allergies: only if mentioned
${isMultiSpeaker
  ? '- Attribute every finding to the correct speaker (doctor or patient).'
  : '- Single narrator — no speaker attribution needed.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — SOAP NOTE CONSTRUCTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write a complete, professional SOAP note in English using ONLY extracted data.

SUBJECTIVE: Patient narrative in clinical prose.
- Chief complaint in the patient's own words (quote where possible)
- History of present illness: onset, duration, character, severity, aggravating and relieving factors
- Relevant past medical history, current medications, allergies

OBJECTIVE: Measured and observed findings only.
- Clinician-measured vitals with actual numeric values
- Patient-reported measurements labeled clearly: "Patient-reported: Temp 101°F (home measurement)"
- Physical examination findings as stated by the clinician
- If a vital sign or exam finding was not mentioned: omit it entirely.
  Do NOT write "Not recorded", "Not assessed", or "Not available".
  Silence = absent data. Absent data = not written.

ASSESSMENT: Clinical impression with explicit reasoning.
- Primary working diagnosis
- Differential diagnoses if clinically relevant
- Explicitly link findings to the assessment. Avoid vague statements like "patient unwell".

PLAN: Specific, actionable clinical decisions.
- Investigations ordered (with rationale)
- Medications prescribed (name, dose, frequency, duration)
- Referrals and procedures
- Patient education and lifestyle advice given
- Follow-up timing and conditions for return

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — MEDICAL CODING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Assign standard medical codes based on this encounter.

CPT® CODES: Most appropriate E&M code based on visit complexity.
  Examples: 99213 (low), 99214 (moderate), 99215 (high)
  Add procedure codes if any procedures were performed.
  For each: code, description, justification.

ICD-10-CM CODES: Most specific code for each diagnosis.
  Primary diagnosis first. Use highest specificity available.
  Examples: J06.9 (Acute URI), I10 (Essential hypertension)
  For each: code, description, justification.

HCPCS LEVEL II: Only if supplies or non-physician services were mentioned.
  If none apply: return [].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — RETURN THIS JSON AND NOTHING ELSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "soap_note": {
    "subjective": "...",
    "objective": "...",
    "assessment": "...",
    "plan": "..."
  },
  "medical_codes": {
    "cpt": [
      {"code": "99214", "description": "...", "justification": "..."}
    ],
    "icd10": [
      {"code": "J06.9", "description": "...", "justification": "..."}
    ],
    "hcpcs": []
  }
}`;

    const userPrompt = `Generate a complete clinical SOAP note with medical coding from the following transcript.

${isMultiSpeaker ? 'TRANSCRIPT TYPE: Doctor–patient dialogue (multi-speaker)\n' : 'TRANSCRIPT TYPE: Single clinician narration\n'}
TRANSCRIPT:
${transcript}

Reason through all 3 steps. Then return ONLY the JSON object.`;

    const response = await this._callWithModelFallback(systemPrompt, userPrompt);
    return this._parseJSON(response);
  },

  /**
   * Stage 3 — Surgical rewrite applying Agent 2's corrections (Agent 1 rewrite pass).
   * Only called when hallucinations_detected > 0. Temperature 0.10 for determinism.
   * Single pass only — no iteration.
   */
  async _rewriteWithCorrections(transcript, originalSoapNote, correctionsRequired, isMultiSpeaker, language) {
    const systemPrompt = `You are a clinical documentation editor. You will receive a SOAP note and a list of specific corrections that must be applied to it.

Your ONLY job is to apply exactly those corrections and return the fixed note.
Do NOT change anything that is not listed in the corrections.
Do NOT add new information.
Do NOT rewrite sections that are not mentioned.
Return the corrected SOAP note in the same format as the input.

NEVER output anything except the final JSON object.
No markdown fences. No preamble. No explanation. Raw JSON only.`;

    const userPrompt = `Apply the following corrections to the SOAP note. Change ONLY what is listed. Return the corrected note only.

ORIGINAL SOAP NOTE:
${originalSoapNote}

CORRECTIONS TO APPLY:
${JSON.stringify(correctionsRequired, null, 2)}

Return this JSON:
{
  "soap_note": {
    "subjective": "...",
    "objective": "...",
    "assessment": "...",
    "plan": "..."
  }
}`;

    const response = await this._callWithModelFallback(systemPrompt, userPrompt, 0.10);
    return this._parseJSON(response);
  },

  /**
   * Retry wrapper with exponential backoff + jitter (H6).
   *
   * Retries on transient failures: 429 (rate-limit), 5xx (server errors),
   * network errors, and timeouts.
   *
   * Does NOT retry permanent failures: 400 (bad request), 401 (invalid key),
   * 403 (forbidden), 422 (unprocessable) — these must be fixed, not retried.
   *
   * Backoff schedule (maxAttempts = 3):
   *   Attempt 1 fails → wait ~1 s → attempt 2
   *   Attempt 2 fails → wait ~2 s → attempt 3
   *   Attempt 3 fails → throw
   */
  async _withRetry(fn, maxAttempts = 3) {
    const PERMANENT_HTTP = new Set([400, 401, 403, 404, 422, 429]); // 429 = quota exceeded — fail fast, don't retry
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // Extract HTTP status from messages like "Groq API error (429): ..."
        const statusMatch = error.message?.match(/\((\d{3})\)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : null;
        // Permanent HTTP error — throw immediately, no point retrying
        if (status && PERMANENT_HTTP.has(status)) throw error;
        // Last attempt exhausted — throw
        if (attempt === maxAttempts) break;
        // Exponential backoff: 1 s → 2 s → 4 s, plus up to 500 ms jitter
        const delay = (Math.pow(2, attempt - 1) * 1000) + (Math.random() * 500);
        if (__DEV__) console.log(`[OpenRouter] Attempt ${attempt}/${maxAttempts} failed — retrying in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  },

  /**
   * Call a single model tier — wrapped in _withRetry for transient resilience.
   * Accepts a tier object from MODEL_TIERS so each tier can use its own
   * URL, API key, and headers (Groq vs OpenRouter).
   * 429 is in PERMANENT_HTTP so quota errors fail fast without burning retries.
   * temperature defaults to 0.15; pass 0.10 for the surgical rewrite pass.
   */
  async _callSingleTier(tier, systemPrompt, userPrompt, temperature = 0.15) {
    return this._withRetry(async () => {
      const response = await fetch(tier.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tier.getKey()}`,
          'Content-Type': 'application/json',
          ...tier.headers,
        },
        body: JSON.stringify({
          model: tier.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: 8000,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SOAP API error (${response.status}): ${errText}`);
      }

      const result = await response.json();
      // Accumulate token usage for cost-saved calculation
      if (result.usage && this._tokenAccumulator) {
        this._tokenAccumulator.promptTokens     += result.usage.prompt_tokens     || 0;
        this._tokenAccumulator.completionTokens += result.usage.completion_tokens || 0;
      }
      return result.choices[0].message.content;
    });
  },

  /**
   * 3-tier model fallback chain (Groq primary, OpenRouter last resort).
   * Tries Tier 1 → Tier 2 → Tier 3 in order.
   * Skips any tier whose API key is not configured.
   * Each tier uses _withRetry internally (but 429 = fail fast, no retry).
   * Only throws if ALL available tiers fail — caller falls through to HF pipeline.
   * temperature is forwarded to _callSingleTier (default 0.15).
   */
  async _callWithModelFallback(systemPrompt, userPrompt, temperature = 0.15) {
    const errors = [];
    for (const tier of MODEL_TIERS) {
      const key = tier.getKey();
      if (!key) {
        if (__DEV__) console.log(`[SOAP] Skipping ${tier.label} — API key not set`);
        errors.push(`${tier.label}: API key not set`);
        continue;
      }
      try {
        if (__DEV__) console.log(`[SOAP] Trying: ${tier.label}`);
        const result = await this._callSingleTier(tier, systemPrompt, userPrompt, temperature);
        if (__DEV__) console.log(`[SOAP] Success: ${tier.label}`);
        this._lastModelUsed = tier.label;
        return result;
      } catch (err) {
        errors.push(`${tier.label}: ${err.message}`);
        console.warn(`[SOAP] Failed (${tier.label}):`, err.message);
      }
    }
    // All tiers exhausted — throw so caller falls through to HF pipeline
    throw new Error(`All SOAP generation tiers failed — ${errors.join(' | ')}`);
  },

  /**
   * Calculate API cost saved vs GPT-4o per generation run (internal metric).
   * GPT-4o pricing (2025): $2.50 / 1M input tokens, $10.00 / 1M output tokens.
   */
  _calculateCostSaved({ promptTokens, completionTokens }) {
    const inputRate  = 2.50  / 1_000_000;
    const outputRate = 10.00 / 1_000_000;
    const saved = (promptTokens * inputRate) + (completionTokens * outputRate);
    return parseFloat(saved.toFixed(4));
  },

  /**
   * Estimate physician time & money saved vs writing this SOAP note manually.
   *
   * Research basis:
   *   - Manual SOAP documentation takes 8–20 min depending on visit complexity.
   *   - Physician rate: $150/hr (conservative US estimate ≈ $2.50/min).
   *
   * Formula:
   *   baseMinutes     = 8   (any SOAP note)
   *   complexityBonus = 1 min per 80 transcript words, capped at 12
   *   revisionBonus   = 1 min per AI revision (complex cases are longer manually too)
   *   rawTimeSaved    = min(base + complexity + revision, 22) min
   *
   * Quality-score normalisation:
   *   A note with 85% quality means the doctor still edits ~15% of it manually,
   *   so effective time saved = rawTimeSaved × qualityScore.
   *   This keeps the figure honest — a perfect note saves more than a rough one.
   *
   *   timeSaved  = rawTimeSaved × qualityScore
   *   moneySaved = timeSaved × $2.50
   */
  _estimateValueSaved(transcript, revisionCount, qualityScore) {
    const words             = transcript ? transcript.trim().split(/\s+/).length : 0;
    const baseMinutes       = 8;
    const complexityMinutes = Math.min(Math.floor(words / 80), 12);
    const revisionMinutes   = Math.min(revisionCount, 2);
    const rawMinutes        = Math.min(baseMinutes + complexityMinutes + revisionMinutes, 22);
    const timeSavedMinutes  = Math.round(rawMinutes * qualityScore);   // quality-adjusted
    const moneySavedUSD     = parseFloat((timeSavedMinutes * (150 / 60)).toFixed(2));
    return { timeSavedMinutes, moneySavedUSD };
  },

  /**
   * Parse JSON from LLM response (handles markdown code blocks and conversational filler)
   */
  _parseJSON(text) {
    try {
      let cleaned = text.trim();

      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }

      // Gemini sometimes emits trailing commas before } or ] — strip them
      // before parsing so we don't throw on otherwise valid responses.
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

      return JSON.parse(cleaned);
    } catch (error) {
      if (__DEV__) {
        console.error('JSON Parse Error:', error);
        console.error('Raw text:', text);
      }
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  },

  /**
   * Format SOAP note for display
   */
  _formatSOAPNote(soapNote) {
    return `# Subjective
${soapNote.subjective}

# Objective
${soapNote.objective}

# Assessment
${soapNote.assessment}

# Plan
${soapNote.plan}`;
  }
};
