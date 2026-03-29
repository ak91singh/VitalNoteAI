import { CONFIG } from '../config';

// ---------------------------------------------------------------------------
// Language-specific medical prompts for Whisper.
// These "prime" the model vocabulary toward medical doctor-patient speech,
// dramatically improving accuracy for non-English clinical audio.
// ISO-639-1 codes match the LANGUAGES array in ConsultationScreen.
// ---------------------------------------------------------------------------
const WHISPER_MEDICAL_PROMPTS = {
    en: "Doctor-patient consultation. Symptoms, diagnosis, blood pressure, medication, fever, prescription, diabetes.",
    es: "Conversación médico-paciente. Síntomas, diagnóstico, presión arterial, medicamento, fiebre, diabetes.",
    de: "Arzt-Patienten-Gespräch. Symptome, Diagnose, Blutdruck, Medikament, Fieber, Diabetes.",
    fr: "Conversation médecin-patient. Symptômes, diagnostic, tension artérielle, médicament, fièvre, diabète.",
    hi: "डॉक्टर और मरीज़ की बातचीत। BP, sugar, fever, diabetes, prescription, symptoms, diagnosis.",
    ta: "மருத்துவர்-நோயாளி உரையாடல். அறிகுறிகள், நோய் கண்டறிதல், இரத்த அழுத்தம், மருந்து, காய்ச்சல், நீரிழிவு.",
    te: "వైద్యుడు-రోగి సంభాషణ. లక్షణాలు, రోగ నిర్ధారణ, రక్తపోటు, మందు, జ్వరం, మధుమేహం.",
    pt: "Conversa médico-paciente. Sintomas, diagnóstico, pressão arterial, medicamento, febre, diabetes.",
    it: "Conversazione medico-paziente. Sintomi, diagnosi, pressione sanguigna, farmaco, febbre, diabete.",
    ru: "Консультация врача и пациента. Симптомы, диагноз, давление, лекарство, температура, диабет.",
    zh: "医生和病人的对话。症状，诊断，血压，药物，发烧，糖尿病。",
    ja: "医師と患者の会話。症状、診断、血圧、薬、発熱、糖尿病。",
    ko: "의사와 환자의 대화. 증상, 진단, 혈압, 약물, 발열, 당뇨병.",
    ar: "محادثة بين الطبيب والمريض. الأعراض والتشخيص وضغط الدم والدواء والحمى والسكري.",
    nl: "Arts-patiëntgesprek. Symptomen, diagnose, bloeddruk, medicatie, koorts, diabetes.",
    pl: "Rozmowa lekarz-pacjent. Objawy, diagnoza, ciśnienie krwi, lek, gorączka, cukrzyca.",
    tr: "Doktor-hasta konuşması. Belirtiler, tanı, kan basıncı, ilaç, ateş, diyabet.",
    uk: "Консультація лікаря і пацієнта. Симптоми, діагноз, тиск, ліки, температура, діабет.",
    sv: "Läkare-patientsamtal. Symtom, diagnos, blodtryck, medicin, feber, diabetes.",
    no: "Lege-pasientsamtale. Symptomer, diagnose, blodtrykk, medisin, feber, diabetes.",
    da: "Læge-patientsamtale. Symptomer, diagnose, blodtryk, medicin, feber, diabetes.",
    fi: "Lääkäri-potilaskeskustelu. Oireet, diagnoosi, verenpaine, lääke, kuume, diabetes.",
    cs: "Rozhovor lékaře a pacienta. Příznaky, diagnóza, krevní tlak, lék, horečka, cukrovka.",
    ro: "Consultație medic-pacient. Simptome, diagnostic, tensiune arterială, medicament, febră, diabet.",
    hu: "Orvos-beteg konzultáció. Tünetek, diagnózis, vérnyomás, gyógyszer, láz, cukorbetegség.",
    el: "Συνομιλία γιατρού-ασθενή. Συμπτώματα, διάγνωση, αρτηριακή πίεση, φάρμακο, πυρετός, διαβήτης.",
    id: "Konsultasi dokter-pasien. Gejala, diagnosis, tekanan darah, obat, demam, diabetes.",
    ms: "Konsultasi doktor-pesakit. Gejala, diagnosis, tekanan darah, ubat, demam, diabetes.",
    vi: "Cuộc tư vấn bác sĩ-bệnh nhân. Triệu chứng, chẩn đoán, huyết áp, thuốc, sốt, tiểu đường.",
    th: "การปรึกษาระหว่างแพทย์และผู้ป่วย อาการ การวินิจฉัย ความดันโลหิต ยา ไข้ เบาหวาน",
    bn: "ডাক্তার-রোগীর পরামর্শ। উপসর্গ, রোগ নির্ণয়, রক্তচাপ, ওষুধ, জ্বর, ডায়াবেটিস।",
    mr: "डॉक्टर-रुग्ण सल्लामसलत. लक्षणे, निदान, रक्तदाब, औषध, ताप, मधुमेह.",
    gu: "ડૉક્ટર-દર્દી પરામર્શ. લક્ષણો, નિદાન, બ્લડ પ્રેશર, દવા, તાવ, ડાયાબિટીસ.",
    kn: "ವೈದ್ಯ-ರೋಗಿ ಸಮಾಲೋಚನೆ. ಲಕ್ಷಣಗಳು, ರೋಗ ನಿರ್ಣಯ, ರಕ್ತದೊತ್ತಡ, ಔಷಧ, ಜ್ವರ, ಮಧುಮೇಹ.",
    ml: "ഡോക്ടർ-രോഗി കൂടിയാലോചന. ലക്ഷണങ്ങൾ, രോഗനിർണ്ണയം, രക്തസമ്മർദ്ദം, മരുന്ന്, പനി, പ്രമേഹം.",
    pa: "ਡਾਕਟਰ-ਮਰੀਜ਼ ਸਲਾਹ-ਮਸ਼ਵਰਾ। ਲੱਛਣ, ਨਿਦਾਨ, ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ, ਦਵਾਈ, ਬੁਖਾਰ, ਸ਼ੂਗਰ।",
    ur: "ڈاکٹر مریض مشاورت۔ علامات، تشخیص، بلڈ پریشر، دوائی، بخار، ذیابیطس۔",
};

// ---------------------------------------------------------------------------
// XHR-based multipart upload.
// XMLHttpRequest is the battle-tested path for FormData file uploads in
// React Native Android — it shares the same native layer as fetch but avoids
// edge-cases in the fetch polyfill's multipart encoding.
// ---------------------------------------------------------------------------
function xhrMultipart(url, authToken, formData) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        xhr.timeout = 30000;
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); }
                catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
            } else {
                // Include Groq/HF error body in the rejection so it surfaces
                // in the final error message even in non-__DEV__ builds.
                reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText.slice(0, 300)}`));
            }
        };
        xhr.onerror  = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Request timed out (30 s)'));
        xhr.send(formData);
    });
}

// Build FormData for a local audio file URI.
function buildAudioForm(audioUri, extraFields = {}) {
    const uri = audioUri.startsWith('file://') ? audioUri : `file://${audioUri}`;
    const form = new FormData();
    form.append('file', { uri, type: 'audio/m4a', name: 'recording.m4a' });
    Object.entries(extraFields).forEach(([k, v]) => form.append(k, v));
    return form;
}

// ---------------------------------------------------------------------------
// Retry helper — H6 (Play Store Readiness)
//
// Retries a function on transient failures (429, 5xx, network errors).
// Does NOT retry on permanent HTTP errors (400, 401, 403, 422).
// Backoff: ~1 s → ~2 s, then throws.
// Matches error messages from both fetch (HTTP NNN) and XHR (HTTP NNN).
// ---------------------------------------------------------------------------
async function withRetry(fn, maxAttempts = 2) {
    const PERMANENT_HTTP = new Set([400, 401, 403, 404, 422]);
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            // Extract HTTP status from messages like "HTTP 429: ..." or "HTTP 503 ..."
            const statusMatch = error.message?.match(/HTTP\s+(\d{3})/i);
            const status = statusMatch ? parseInt(statusMatch[1]) : null;
            // Permanent HTTP error — rethrow immediately (let caller cascade to next tier)
            if (status && PERMANENT_HTTP.has(status)) throw error;
            // Last attempt — give up
            if (attempt === maxAttempts) break;
            // Exponential backoff: 1 s → 2 s, plus up to 300 ms jitter
            const delay = (Math.pow(2, attempt - 1) * 1000) + (Math.random() * 300);
            if (__DEV__) console.log(`[withRetry] Attempt ${attempt} failed — retrying in ${Math.round(delay)}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
}

export const AIService = {

    async transcribeAudio(audioUri, language = 'en') {
        const uri = audioUri.startsWith('file://') ? audioUri : `file://${audioUri}`;
        // Collect a per-step error trail — included in the final throw so the
        // error dialog shows EXACTLY what each service returned (not just the
        // last 401), even in production/preview builds where __DEV__ is false.
        const errors = [];

        // Resolve the medical prompt for the selected language (fall back to English).
        const medicalPrompt = WHISPER_MEDICAL_PROMPTS[language] || WHISPER_MEDICAL_PROMPTS['en'];

        // ── 0. Groq Whisper via XHR (primary — fast & free) ──────────────────
        // Passing `language` (ISO-639-1) tells Whisper exactly what to expect,
        // skipping auto-detection which is unreliable for non-English medical speech.
        // Passing `prompt` primes the vocabulary toward clinical terminology.
        // withRetry: retries up to 2× on 429 / 5xx / network errors.
        // FormData is rebuilt inside the callback so it's fresh on each attempt.
        if (CONFIG.GROQ_API_KEY) {
            try {
                if (__DEV__) console.log(`Transcribing with Groq Whisper (XHR) — language: ${language}`);
                const data = await withRetry(() => xhrMultipart(
                    'https://api.groq.com/openai/v1/audio/transcriptions',
                    CONFIG.GROQ_API_KEY,
                    buildAudioForm(uri, {
                        model: 'whisper-large-v3',
                        response_format: 'json',
                        language: language,
                        prompt: medicalPrompt,
                    })
                ));
                return data.text;
            } catch (err) {
                errors.push(`Groq: ${err.message}`);
                if (__DEV__) console.log('Groq Whisper XHR failed:', err.message);
            }
        } else {
            errors.push('Groq: no API key configured');
        }

        // ── 1. HF Inference API — raw binary body ─────────────────────────────
        // HF's serverless ASR endpoint expects audio bytes as the raw body,
        // NOT multipart — unlike Groq.
        // Language is passed as a query parameter supported by the HF inference API.
        // Note: audioBlob is read once outside withRetry (local file read, no network).
        // withRetry wraps only the HF network call; throwing inside ensures retry fires.
        try {
            if (__DEV__) console.log(`Attempting HF Inference (binary) — language: ${language}`);
            const fileResponse = await fetch(uri);
            const audioBlob = await fileResponse.blob();
            const text = await withRetry(async () => {
                const res = await fetch(
                    `https://api-inference.huggingface.co/models/openai/whisper-large-v3?language=${language}`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${CONFIG.HF_API_TOKEN}`,
                            'Content-Type': 'audio/m4a',
                        },
                        body: audioBlob,
                    }
                );
                if (!res.ok) {
                    const body = await res.text();
                    throw new Error(`HTTP ${res.status}: ${body.slice(0, 150)}`);
                }
                return (await res.json()).text;
            });
            return text;
        } catch (hfErr) {
            errors.push(`HF-Inf: ${hfErr.message}`);
            if (__DEV__) console.log('HF Inference error:', hfErr.message);
        }

        // ── 2. HF Router via XHR (last resort) ───────────────────────────────
        // language is passed as a multipart form field.
        try {
            if (__DEV__) console.log(`Attempting HF Router (XHR) — language: ${language}`);
            const data = await withRetry(() => xhrMultipart(
                'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3',
                CONFIG.HF_API_TOKEN,
                buildAudioForm(uri, { language: language })
            ));
            return data.text;
        } catch (routerErr) {
            errors.push(`HF-Router: ${routerErr.message}`);
            if (__DEV__) console.log('HF Router failed:', routerErr.message);
        }

        // All three attempts failed — surface every error so the dialog is useful
        throw new Error(`Transcription failed — ${errors.join(' | ')}`);
    },

    async generateSOAP(transcript, template = null, isMultiSpeaker = false, language = 'en') {
        if (__DEV__) console.log("Generating SOAP...", { primary: CONFIG.PRIMARY_MODEL_ID, isMultiSpeaker, language });

        const baseInstructions = template?.systemPrompt || `You are a disciplined medical documentation assistant. Generate ONLY a SOAP note based EXCLUSIVELY on the input.`;

        let instructions = baseInstructions + `
CRITICAL REQUIREMENTS:
1. **LANGUAGE**: Input is in ${language.toUpperCase()}. You MUST output the final SOAP note in STANDARD MEDICAL ENGLISH. Translate all clinical findings accurately.
   - *Translation Note for Indic Languages*: Be precise with adjectives (e.g., distinguish "Yellow sputum" vs "White sputum"). Do not confuse similar sounding words.
2. **AMBIENT INTELLIGENCE**: Do not just transcribe. INTERPRET.
    - If patient say "Ouch when I move arm", write "Pain with range of motion".
    - If patient says "I can't climb stairs", write "Mobility limitation / Dyspnea on exertion" depending on context.
3. **STRICT SOAP STRUCTURE**:
    - **ORDER**: # Subjective -> # Objective -> # Assessment -> # Plan.
    - **MEDICATIONS**: Suggested medications MUST be listed under **# Plan**.
    - **EXTRAS**: If you have extra info (Detailed History, Clinical Rationale) that fits nowhere else, add it as **# Additional Context** at the very end.
    - **ANTI-HALLUCINATION**: If Vitals (BP, HR, Temp) are not explicitly stated, DO NOT INVENT THEM. Omit them entirely.
4. **FORMAT**: Use this Markdown structure:
# Subjective
[Translated & Interpreted History]
# Objective
[Observed Vitals/Exam]
# Assessment
[Clinical Impression]
# Plan
[Actionable Steps & Medications]
# Additional Context
[Optional: History of Illness, Rationale, etc]
`;

        if (isMultiSpeaker) {
            instructions += `
5. **MULTI-SPEAKER**: The transcript is a raw dialogue.
    - Distinguish between the Provider's queries and Patient's responses.
    - Attribute findings correctly (e.g., "Patient Reports", "Clinician Observed").`;
        } else {
            instructions += `
5. **SINGLE SOURCE**: Summarize the dictation or narrative into structured sections.`;
        }

        const messages = [
            { role: "system", content: instructions },
            { role: "user", content: `Transcript (${language}):\n"${transcript}"` }
        ];

        // 1. Dedicated Endpoint Strategy (Production — only runs if DEDICATED_ENDPOINT_URL is set)
        if (CONFIG.DEDICATED_ENDPOINT_URL && CONFIG.DEDICATED_ENDPOINT_URL.length > 0) {
            if (__DEV__) console.log("Using Dedicated Endpoint...");

            const userContent = messages.find(m => m.role === "user")?.content || "";
            const cleanTranscript = userContent.replace(/Transcript.*:\n/, '').replace(/"/g, '').trim();

            const systemPrompt = `You are a disciplined medical documentation assistant.
            Input Language: ${language}. Output Language: English.
            Task: Translate, Interpret Implicit Cues, and Format as SOAP.
            ${isMultiSpeaker ? "Context: Dialogue (Doctor/Patient)." : "Context: Dictation."}

            CRITICAL CONSTRAINTS:
            1. NO Hallucinated Vitals. If not in text, omit.
            2. **STRUCTURE**:
               - Must start with # Subjective, # Objective, # Assessment, # Plan.
               - **IMPORTANT**: Put "Suggested Medications" INSIDE # Plan.
               - **EXTRAS**: You MAY add a header # Additional Context *after* the Plan if you have valuable insights (History, Rationale).
            3. Precise Translation (Colors/Adjectives).

            CRITICAL: You must use these exact Markdown headers in this order:
            # Subjective
            # Objective
            # Assessment
            # Plan
            # Additional Context (Optional)`;

            const twoShotPrompt = `[INST] ${systemPrompt}

Example 1:
Input: "Patient has a sore throat and fever of 101 since yesterday."
Output:
# Subjective
- Patient reports sore throat and fever (101 F) starting yesterday.
# Objective
- Exams pending.
# Assessment
- Possible viral pharyngitis.
# Plan
1. Rest and fluids.
2. Monitor temperature.

Example 2:
Input: "50-year-old male with chest pain. BP 150/90. No history of heart disease. Pain is non-radiating. Lungs clear."
Output:
# Subjective
- 50yo male with chest pain.
- Pain is non-radiating.
- Denies history of heart disease.
# Objective
- BP 150/90.
- Lungs clear.
# Assessment
- Chest pain, hypertension. Low suspicion for ACS.
# Plan
1. EKG.
2. Cardiac Enzymes.
3. Observation.

Input: "${cleanTranscript}"
Output:
[/INST]`;

            try {
                let generatedText = await this.callDedicatedTextGen(CONFIG.DEDICATED_ENDPOINT_URL, twoShotPrompt);

                if (generatedText.includes("# Subjective") && !generatedText.startsWith("# Subjective")) {
                    const subjIndex = generatedText.indexOf("# Subjective");
                    generatedText = generatedText.substring(subjIndex);
                } else if (!generatedText.startsWith("# Subjective")) {
                    generatedText = "# Subjective\n" + generatedText;
                }

                const stopMarkers = ["AIM", "INTRODUCTION", "PATIENTS AND METHODS", "ABSTRACT", "REFERENCES", "Example Input", "Example 1", "Example 2", "### Example", "Input:", "[/INST]", "Output:", "User:", "Assistant:", "Think step-by-step:"];
                for (const marker of stopMarkers) {
                    const idx = generatedText.indexOf(marker);
                    if (idx !== -1) generatedText = generatedText.substring(0, idx);
                }

                return generatedText.trim();

            } catch (err) {
                if (__DEV__) console.error("Dedicated Endpoint failed:", err);
                // Fallthrough to free router
            }
        }

        // 2. Router/Fallback Strategy (Free)
        try {
            if (__DEV__) console.log(`Attempting generation with ${CONFIG.PRIMARY_MODEL_ID}...`);
            return await this.tryGenerate(CONFIG.PRIMARY_MODEL_ID, messages);
        } catch (primaryError) {
            if (__DEV__) console.warn(`Primary model failed:`, primaryError.message);
            try {
                return await this.tryGenerate(CONFIG.FALLBACK_MODEL_ID, messages);
            } catch (fallbackError) {
                console.error('[VitalNoteAI] All SOAP generation services failed:', fallbackError.message);
                throw new Error(
                    'ALL_SERVICES_FAILED: Unable to generate SOAP note. ' +
                    'Primary and fallback AI services are both unreachable. ' +
                    'Please check your internet connection and try again.'
                );
            }
        }
    },

    // Helper for Dedicated TGI Endpoint (Raw Text Generation)
    async callDedicatedTextGen(url, prompt) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CONFIG.HF_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 1200,
                    return_full_text: false,
                    temperature: 0.1,
                    repetition_penalty: 1.2,
                    do_sample: true,
                    top_p: 0.90
                }
            }),
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Dedicated API Error ${response.status}: ${txt}`);
        }

        const result = await response.json();
        // TGI returns [{ "generated_text": "..." }]
        return Array.isArray(result) ? result[0].generated_text : result.generated_text;
    },

    async tryGenerate(modelId, messages) {
        const isLegacyTextGen = modelId.includes("meditron");

        let url, body;

        if (isLegacyTextGen) {
            url = `https://router.huggingface.co/models/${modelId}`;
            const systemContent = messages.find(m => m.role === "system")?.content || "";
            const userContent = messages.find(m => m.role === "user")?.content || "";
            const prompt = `[INST] <<SYS>>\n${systemContent}\n<</SYS>>\n\n${userContent} [/INST]`;

            body = {
                inputs: prompt,
                parameters: {
                    max_new_tokens: 1200,
                    return_full_text: false,
                    temperature: 0.3
                }
            };
        } else {
            url = `https://router.huggingface.co/v1/chat/completions`;
            body = {
                model: modelId,
                messages: messages,
                max_tokens: 512,
                temperature: 0.3,
                stream: false
            };
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CONFIG.HF_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        const result = await response.json();

        if (isLegacyTextGen) {
            return Array.isArray(result) ? result[0].generated_text : result.generated_text;
        } else {
            return result.choices[0].message.content;
        }
    }
};
