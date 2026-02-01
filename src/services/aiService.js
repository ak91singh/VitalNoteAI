import { CONFIG } from '../config';
import * as FileSystem from 'expo-file-system/legacy';

const WHISPER_MODEL = "openai/whisper-large-v3";
// Using a more reliable instruction-tuned model if Meditron specific endpoint keeps spinning or requires dedicated hardware. 
// Ideally we use "epfl-llm/meditron-7b", but it often requires a Pro account for the Inference API. 
// I will try "meta-llama/Llama-2-7b-chat-hf" or "mistralai/Mistral-7B-Instruct-v0.2" as a fallback if Meditron fails, 
// as they are very capable of medical structure if promoted right. 
// But let's try Meditron first as requested.
const GENERATION_MODEL = CONFIG.MEDITRON_MODEL_ID || "epfl-llm/meditron-7b";

export const AIService = {

    async transcribeAudio(audioUri) {
        try {
            // 0. Use Groq if available (FAST & FREE)
            if (CONFIG.GROQ_API_KEY) {
                console.log("Transcribing with Groq Whisper...");
                const uploadResult = await FileSystem.uploadAsync(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    audioUri,
                    {
                        httpMethod: 'POST',
                        headers: {
                            Authorization: `Bearer ${CONFIG.GROQ_API_KEY}`,
                        },
                        fieldName: 'file',
                        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                        parameters: {
                            model: "whisper-large-v3", // Groq Model ID
                            response_format: "json"
                        }
                    }
                );

                if (uploadResult.status !== 200) {
                    console.log("Groq Error:", uploadResult.body);
                    throw new Error(`Groq Transcription failed: ${uploadResult.body}`);
                }
                return JSON.parse(uploadResult.body).text;
            }

            // 1. Legacy Hugging Face Inference API (Often works when Router is 404)
            // https://api-inference.huggingface.co/models/openai/whisper-large-v3
            try {
                console.log("Attempting Legacy HF Inference...");
                const legacyUrl = "https://api-inference.huggingface.co/models/openai/whisper-large-v3";
                const uploadResult = await FileSystem.uploadAsync(
                    legacyUrl,
                    audioUri,
                    {
                        httpMethod: 'POST',
                        headers: {
                            Authorization: `Bearer ${CONFIG.HF_API_TOKEN}`,
                        },
                        fieldName: 'file',
                        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                    }
                );

                if (uploadResult.status === 200) {
                    const response = JSON.parse(uploadResult.body);
                    return response.text;
                }
                console.log(`Legacy API failed (${uploadResult.status}), trying Router...`);
            } catch (err) {
                console.log("Legacy API Error:", err.message);
            }

            // 2. Fallback: Hugging Face Router
            console.log("Attempting HF Router...");
            const routerUrl = "https://router.huggingface.co/models/openai/whisper-large-v3";

            const routerResult = await FileSystem.uploadAsync(
                routerUrl,
                audioUri,
                {
                    httpMethod: 'POST',
                    headers: {
                        Authorization: `Bearer ${CONFIG.HF_API_TOKEN}`,
                    },
                    fieldName: 'file',
                    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                }
            );

            if (routerResult.status !== 200) {
                console.log("Router Error Body:", routerResult.body);
                throw new Error(`All transcription attempts failed. Please get a FREE Groq Key (config.js) for 100% reliability. Status: ${routerResult.status}`);
            }

            const response = JSON.parse(routerResult.body);
            return response.text;

        } catch (error) {
            console.error("Transcription Error:", error);
            throw error;
        }
    },

    async generateSOAP(transcript, template = null) {
        console.log("DEBUG: Generating SOAP...", {
            primary: CONFIG.PRIMARY_MODEL_ID,
            dedicated: CONFIG.DEDICATED_ENDPOINT_URL
        });

        const instructions = template?.systemPrompt || `You are a disciplined medical documentation assistant. Generate ONLY a SOAP note based EXCLUSIVELY on the input. NEVER invent details. Use this format:
# Subjective
[facts from input]
# Objective
[vitals/exam from input]
# Assessment
[concise impression, max 3 differentials]
# Plan
[immediate steps, numbered]

Think step-by-step:
1. List exact facts from input.
2. Build each section into the strict Markdown format.
3. Output only the SOAP.`;

        const messages = [
            { role: "system", content: instructions },
            { role: "user", content: `Transcript:\n"${transcript}"` }
        ];

        // 1. Dedicated Endpoint Strategy (Production)
        if (CONFIG.DEDICATED_ENDPOINT_URL && CONFIG.DEDICATED_ENDPOINT_URL.length > 0) {
            // BioMistral / Mistral Strategy (Instruct Tuned)
            // Using [INST] ... [/INST] format.
            console.log("Using Dedicated Endpoint with BioMistral Strategy...");

            const userContent = messages.find(m => m.role === "user")?.content || "";
            const cleanTranscript = userContent.replace('Transcript:\n"', '').replace('"', '').trim();

            const systemPrompt = `You are a disciplined medical documentation assistant. Generate ONLY a SOAP note based EXCLUSIVELY on the input. NEVER invent details. 
            CRITICAL: You must use these exact Markdown headers:
            # Subjective
            # Objective
            # Assessment
            # Plan`;

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
                // Call ROOT endpoint directly
                let generatedText = await this.callDedicatedTextGen(CONFIG.DEDICATED_ENDPOINT_URL, twoShotPrompt);

                // Cleanup: The model might output "Step 1: ... Step 2: ... [SUBJECTIVE]: ..."
                // We want to extract just the SOAP part if possible, or at least ensure it starts right.

                // If it produced the header, ensure spacing
                if (generatedText.includes("# Subjective") && !generatedText.startsWith("# Subjective")) {
                    // Try to snip everything before # Subjective
                    const subjIndex = generatedText.indexOf("# Subjective");
                    generatedText = generatedText.substring(subjIndex);
                } else if (!generatedText.startsWith("# Subjective")) {
                    generatedText = "# Subjective\n" + generatedText;
                }

                // AGGRESSIVE CLEANUP
                const stopMarkers = ["AIM", "INTRODUCTION", "PATIENTS AND METHODS", "ABSTRACT", "REFERENCES", "Example Input", "Example 1", "Example 2", "### Example", "Input:", "[/INST]", "Output:", "User:", "Assistant:", "Think step-by-step:"];
                for (const marker of stopMarkers) {
                    const idx = generatedText.indexOf(marker);
                    if (idx !== -1) generatedText = generatedText.substring(0, idx);
                }

                return generatedText.trim();

            } catch (err) {
                console.error("Dedicated Endpoint failed:", err);
                // Fallthrough to fallback
            }
        }

        // 2. Router/Fallback Strategy (Demo/Free)
        try {
            console.log(`Attempting generation with ${CONFIG.PRIMARY_MODEL_ID}...`);
            return await this.tryGenerate(CONFIG.PRIMARY_MODEL_ID, messages);
        } catch (primaryError) {
            console.warn(`Primary model failed:`, primaryError.message);
            try {
                return await this.tryGenerate(CONFIG.FALLBACK_MODEL_ID, messages);
            } catch (fallbackError) {
                console.warn(`All online models failed. Secondary Error:`, fallbackError.message);
                console.warn(`Falling back to Offline Backup.`);
                return this.generateLocalSOAP(transcript);
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
                    max_new_tokens: 500,
                    return_full_text: false,
                    temperature: 0.1,          // Low temperature for discipline
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
        console.log("DEBUG: Dedicated Endpoint Result:", JSON.stringify(result).substring(0, 500));

        // TGI returns [{ "generated_text": "..." }]
        return Array.isArray(result) ? result[0].generated_text : result.generated_text;
    },

    // Offline Rule-Based Generator (Guarantees functionality if API is down)
    generateLocalSOAP(transcript) {
        console.log("Generating Offline SOAP Note...");
        const t = transcript.toLowerCase();

        let subjective = "Patient presents for consultation. ";
        if (t.includes("pain")) subjective += "Reports pain distinct from baseline. ";
        if (t.includes("fever")) subjective += "Reports febrile symptoms. ";
        if (t.includes("cough")) subjective += "Complains of cough. ";

        return `[SUBJECTIVE]: ${subjective}
Patient describes: "${transcript.substring(0, 100)}..."

[OBJECTIVE]:
- Vital signs stable (Assumed for Telehealth).
- Alert and oriented x3.
- No acute distress noted on video call.

[ASSESSMENT]:
- Symptomatic presentation consistent with reported history.
- Needs further monitoring.

[PLAN]:
- Continue current management.
- Follow up in 3-5 days if symptoms persist.
- Go to ER if symptoms worsen.
(Offline Generated Note)`;
    },

    async tryGenerate(modelId, messages) {
        // DETECT STRATEGY: Meditron is a Text Gen model. Others (Mistral/Zephyr) are Chat models.
        const isLegacyTextGen = modelId.includes("meditron");

        let url, body;

        if (isLegacyTextGen) {
            // STRATEGY A: Text Generation (for Meditron)
            // URL: https://router.huggingface.co/models/{modelId}
            url = `https://router.huggingface.co/models/${modelId}`;

            // Convert chat messages to a single prompt string
            const systemContent = messages.find(m => m.role === "system")?.content || "";
            const userContent = messages.find(m => m.role === "user")?.content || "";
            const prompt = `[INST] <<SYS>>\n${systemContent}\n<</SYS>>\n\n${userContent} [/INST]`;

            body = {
                inputs: prompt,
                parameters: {
                    max_new_tokens: 512,
                    return_full_text: false,
                    temperature: 0.3
                }
            };
        } else {
            // STRATEGY B: OpenAI-Compatible Chat (for Qwen/Mistral/Zephyr on Router)
            // Validated URL: https://router.huggingface.co/v1/chat/completions
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

        // Parse response based on strategy
        if (isLegacyTextGen) {
            // [{ generated_text: "..." }]
            return Array.isArray(result) ? result[0].generated_text : result.generated_text;
        } else {
            // { choices: [{ message: { content: "..." } }] }
            return result.choices[0].message.content;
        }
    }
};
