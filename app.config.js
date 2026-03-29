// app.config.js — replaces app.json
// Using a JS file so we can read from .env during local development.
// EAS cloud builds use the secrets you uploaded via `eas secret:create`.

// Key loading strategy:
// 1. For `eas build --local`: EAS CLI pre-sets env vars from eas.json to "" when the
//    shell var isn't exported. dotenv won't overwrite a "" by default, so we read the
//    .env file directly with `fs` — this is immune to EAS env-var pre-seeding.
// 2. For EAS cloud builds: .env is gitignored and won't exist, so fs.existsSync
//    returns false and we fall through to process.env (which has the EAS secrets).
// 3. For `npx expo start`: dotenv path also works, but fs read is equally fine.
const path = require('path');
const fs = require('fs');

function loadEnvFile() {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) return {};
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    const result = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
        }
    }
    return result;
}

const envFile = loadEnvFile();

// Filter out literal $VAR_NAME strings that EAS CLI injects when the
// corresponding shell variable is not exported before running `eas build --local`.
// e.g. eas.json { "GROQ_API_KEY": "$GROQ_API_KEY" } → process.env = "$GROQ_API_KEY" (13 chars)
// — that is NOT a valid key and must be discarded.
function resolveKey(fromFile, fromEnv) {
    const val = fromFile || fromEnv || '';
    return /^\$[A-Z_]+$/.test(val) ? '' : val;   // discard unexpanded shell-var references
}

const GROQ_API_KEY   = resolveKey(envFile.GROQ_API_KEY,   process.env.GROQ_API_KEY);
const HF_API_TOKEN   = resolveKey(envFile.HF_API_TOKEN,   process.env.HF_API_TOKEN);
const OPENROUTER_API_KEY = resolveKey(envFile.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEY);

// ── Build-time key validation ──────────────────────────────────────────────
// Printed by every build phase — confirms the key is real (right length/prefix)
// without exposing the full secret in logs.
console.warn(
    '[app.config.js] GROQ_API_KEY status:',
    GROQ_API_KEY
        ? `loaded (len=${GROQ_API_KEY.length}, prefix=${GROQ_API_KEY.slice(0, 7)})`
        : 'MISSING — run .\\build-local.ps1 instead of eas build directly'
);
console.warn(
    '[app.config.js] HF_API_TOKEN status:',
    HF_API_TOKEN
        ? `loaded (len=${HF_API_TOKEN.length}, prefix=${HF_API_TOKEN.slice(0, 6)})`
        : 'MISSING — run .\\build-local.ps1 instead of eas build directly'
);
console.warn(
    '[app.config.js] OPENROUTER_API_KEY status:',
    OPENROUTER_API_KEY
        ? `loaded (len=${OPENROUTER_API_KEY.length}, prefix=${OPENROUTER_API_KEY.slice(0, 6)})`
        : 'MISSING — add OPENROUTER_API_KEY to .env or eas secret:create'
);
// ──────────────────────────────────────────────────────────────────────────

module.exports = {
    expo: {
        name: "VitalNoteAI",
        slug: "VitalNoteAI",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/vitalnote_logo.png",
        userInterfaceStyle: "light",
        newArchEnabled: false,
        splash: {
            image: "./assets/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff",
        },
        ios: {
            supportsTablet: true,
            infoPlist: {
                NSMicrophoneUsageDescription:
                    "VitalNote AI needs access to your microphone to record consultations for transcription and analysis.",
            },
        },
        android: {
            package: "com.meditron.vitalnoteai",
            versionCode: 1,
            permissions: ["RECORD_AUDIO", "INTERNET", "MODIFY_AUDIO_SETTINGS"],
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#FFFFFF",
            },
            googleServicesFile: "./google-services.json",
            edgeToEdgeEnabled: false,
        },
        web: {
            favicon: "./assets/vitalnote_logo.png",
        },
        scheme: "vitalnoteai",
        extra: {
            eas: {
                projectId: "d4f27775-af6c-4807-a435-fe0aff7d0908",
            },
            // Resolved above: .env file wins for local builds, EAS secrets win for cloud.
            groqApiKey:           GROQ_API_KEY,
            hfApiToken:           HF_API_TOKEN,
            openRouterApiKey:     OPENROUTER_API_KEY,
        },
        plugins: [
            "@react-native-google-signin/google-signin",
            "expo-secure-store",
            "expo-font",
            [
                "expo-build-properties",
                {
                    android: {
                        compileSdkVersion: 35,
                        targetSdkVersion: 35,
                        minSdkVersion: 24,
                    },
                },
            ],
        ],
    },
};
