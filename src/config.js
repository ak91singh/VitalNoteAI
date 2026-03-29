import Constants from 'expo-constants';

// API keys are loaded from environment variables at build time (via EAS secrets).
// They are NEVER hardcoded here. See: eas.json → build.[profile].env
// and app.json → extra for how they flow through.
//
// For LOCAL development: create a .env file at the project root (already gitignored).
// For EAS builds: run `eas secret:create` to upload keys (see pending.md → B1).

const extra = Constants.expoConfig?.extra ?? {};

export const CONFIG = {
    GROQ_API_KEY:   extra.groqApiKey   || process.env.GROQ_API_KEY   || '',
    HF_API_TOKEN:   extra.hfApiToken   || process.env.HF_API_TOKEN   || '',
    OPENROUTER_API_KEY: extra.openRouterApiKey || process.env.OPENROUTER_API_KEY || '',

    // Dedicated Endpoint (Paid/Custom). Leave empty to use free router.
    DEDICATED_ENDPOINT_URL: '',

    // Free Public Router Models
    PRIMARY_MODEL_ID: 'Qwen/Qwen2.5-7B-Instruct',
    FALLBACK_MODEL_ID: 'HuggingFaceH4/zephyr-7b-beta',
    HF_INFERENCE_BASE: 'https://router.huggingface.co/v1/',

};

// Dev-only safety check: warn if keys are missing so you catch it early
if (__DEV__) {
    if (!CONFIG.GROQ_API_KEY) {
        console.warn('[VitalNoteAI] GROQ_API_KEY is not set. Add it to your .env file.');
    }
    if (!CONFIG.HF_API_TOKEN) {
        console.warn('[VitalNoteAI] HF_API_TOKEN is not set. Add it to your .env file.');
    }
    if (!CONFIG.OPENROUTER_API_KEY) {
        console.warn('[VitalNoteAI] OPENROUTER_API_KEY is not set. Add it to your .env file.');
    }
}
