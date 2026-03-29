/**
 * Hallucination Auditor — Agent 2 (Independent Clinical Audit)
 *
 * A fully self-contained service. It does NOT import anything from
 * AgenticSOAPService. It receives a transcript and a SOAP note from
 * Stage 1 and independently verifies every clinical claim.
 *
 * Model fallback chain mirrors AgenticSOAPService (same tiers, own copy):
 *   Tier 1: Groq  — llama-3.3-70b-versatile
 *   Tier 2: Groq  — llama-3.1-8b-instant
 *   Tier 3: OpenRouter — meta-llama/llama-3.3-70b-instruct:free
 */

import { CONFIG } from '../config';

const GROQ_API_URL       = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL_TIERS = [
  {
    label:   'Groq llama-3.3-70b-versatile',
    model:   'llama-3.3-70b-versatile',
    url:     GROQ_API_URL,
    getKey:  () => CONFIG.GROQ_API_KEY,
    headers: {},
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

export const HallucinationAuditor = {
  /**
   * Independently audit a SOAP note against the source transcript.
   * Returns an audit result object. Throws on complete failure (caller handles gracefully).
   *
   * @param {string} transcript     - Original consultation transcript
   * @param {string} soapNote       - Formatted SOAP note from Stage 1
   * @param {boolean} isMultiSpeaker - Whether transcript is a dialogue
   * @returns {object} audit result matching the Agent 2 JSON schema
   */
  async auditSOAPNote(transcript, soapNote, isMultiSpeaker = true) {
    const systemPrompt = `You are a senior clinical audit specialist. Your only job is to verify whether a SOAP note accurately reflects what was said in a medical transcript.

You did NOT write this SOAP note. You have no knowledge of how it was generated. Treat it as external work submitted for independent review.
Be skeptical. Be precise. Be honest about what you find.

NEVER output anything except the final JSON object.
No markdown fences. No preamble. No explanation. Raw JSON only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You will receive:
  1. The original transcript of a medical consultation
  2. A SOAP note generated from that transcript

For EVERY clinical claim in the SOAP note, verify whether it is:
  (a) Directly stated in the transcript → VERIFIED
  (b) A reasonable clinical interpretation of what was said → ACCEPTABLE
  (c) Not present in the transcript and not reasonably inferable → HALLUCINATION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use SEMANTIC matching. Minor paraphrasing is acceptable.
  ("O2 Sat 96%" vs "oxygen saturation 96%" = same data, not a hallucination)
- Only flag a hallucination if the clinical VALUE is absent or fabricated
- Vitals labeled "Patient-reported:" are valid if the patient stated that value — verify against the transcript, not clinical norms
- hallucinations_detected: integer count of fabricated claims
${isMultiSpeaker
  ? '- misattributions_detected: integer count of correct data assigned to the wrong speaker'
  : '- misattributions_detected: set to 0 (single narrator, no speaker attribution to check)'}
- confidence_score: 0.0–1.0. Any hallucination must push this below 0.85.
- validation_passed: true only if hallucinations_detected === 0
- quality_score: 0.0–1.0, weighted average of dimension scores:
    completeness(25%) + specificity(20%) + clinical_coherence(25%) + professional_quality(30%)
  Score 1.0 means the note needs zero editing by a doctor. Be honest.
  Most notes will score 0.75–0.92.
- strengths: 2–3 specific things done well
- improvements_needed: concrete suggestions (empty array if none)

FOR EACH HALLUCINATION FOUND, you must produce a correction object:
{
  "section": "<subjective|objective|assessment|plan>",
  "claim": "<exact text from the SOAP note that is wrong>",
  "issue": "<why this is not supported by the transcript>",
  "instruction": "<precise instruction for fixing it — remove, replace, or correct with what the transcript actually says>"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — RETURN THIS JSON AND NOTHING ELSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "validation_passed": true,
  "hallucinations_detected": 0,
  "misattributions_detected": 0,
  "confidence_score": 0.91,
  "quality_score": 0.88,
  "dimension_scores": {
    "completeness": 0.90,
    "specificity": 0.85,
    "clinical_coherence": 0.90,
    "professional_quality": 0.88
  },
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements_needed": ["specific improvement 1"],
  "corrections_required": [],
  "concerns": []
}`;

    const userPrompt = `You are auditing the following SOAP note against the original transcript.

TRANSCRIPT:
${transcript}

SOAP NOTE TO AUDIT:
${soapNote}

Review every clinical claim. Return only the JSON audit result.`;

    const response = await this._callWithModelFallback(systemPrompt, userPrompt);
    return this._parseJSON(response);
  },

  /**
   * 3-tier model fallback chain — self-contained copy of AgenticSOAPService pattern.
   */
  async _callWithModelFallback(systemPrompt, userPrompt) {
    const errors = [];
    for (const tier of MODEL_TIERS) {
      const key = tier.getKey();
      if (!key) {
        if (__DEV__) console.log(`[Auditor] Skipping ${tier.label} — API key not set`);
        errors.push(`${tier.label}: API key not set`);
        continue;
      }
      try {
        if (__DEV__) console.log(`[Auditor] Trying: ${tier.label}`);
        const result = await this._callSingleTier(tier, systemPrompt, userPrompt);
        if (__DEV__) console.log(`[Auditor] Success: ${tier.label}`);
        return result;
      } catch (err) {
        errors.push(`${tier.label}: ${err.message}`);
        console.warn(`[Auditor] Failed (${tier.label}):`, err.message);
      }
    }
    throw new Error(`All audit tiers failed — ${errors.join(' | ')}`);
  },

  /**
   * Single tier call with retry. Temperature 0.15 (fixed — auditor always uses same setting).
   */
  async _callSingleTier(tier, systemPrompt, userPrompt) {
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
          temperature: 0.15,
          max_tokens: 1500,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Audit API error (${response.status}): ${errText}`);
      }

      const result = await response.json();
      return result.choices[0].message.content;
    });
  },

  /**
   * Exponential backoff retry — self-contained copy of AgenticSOAPService pattern.
   * 429 is permanent (quota fail-fast).
   */
  async _withRetry(fn, maxAttempts = 3) {
    const PERMANENT_HTTP = new Set([400, 401, 403, 404, 422, 429]);
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const statusMatch = error.message?.match(/\((\d{3})\)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : null;
        if (status && PERMANENT_HTTP.has(status)) throw error;
        if (attempt === maxAttempts) break;
        const delay = (Math.pow(2, attempt - 1) * 1000) + (Math.random() * 500);
        if (__DEV__) console.log(`[Auditor] Attempt ${attempt}/${maxAttempts} failed — retrying in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  },

  /**
   * Parse JSON from LLM response — self-contained copy of AgenticSOAPService pattern.
   */
  _parseJSON(text) {
    try {
      let cleaned = text.trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace  = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(cleaned);
    } catch (error) {
      if (__DEV__) {
        console.error('[Auditor] JSON Parse Error:', error);
        console.error('[Auditor] Raw text:', text);
      }
      throw new Error(`Audit JSON parse failed: ${error.message}`);
    }
  },
};
