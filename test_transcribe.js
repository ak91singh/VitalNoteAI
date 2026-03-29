
const fs = require('fs');
const path = require('path');

// Mock a tiny wav file (header only) to test connectivity
// This likely won't transcribe, but it checks if the server accepts the request vs 404/410.
const wavHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00, // Size
    0x57, 0x41, 0x56, 0x45, // WAVE
    0x66, 0x6d, 0x74, 0x20, // fmt 
    0x10, 0x00, 0x00, 0x00, // Subchunk1Size
    0x01, 0x00, 0x01, 0x00, // AudioFormat 1, NumChannels 1
    0x44, 0xac, 0x00, 0x00, // SampleRate 44100
    0x88, 0x58, 0x01, 0x00, // ByteRate
    0x02, 0x00, 0x10, 0x00, // BlockAlign 2, BitsPerSample 16
    0x64, 0x61, 0x74, 0x61, // data
    0x00, 0x00, 0x00, 0x00  // Subchunk2Size
]);

const { CONFIG } = require('./src/config');
const TOKEN = CONFIG.HF_API_TOKEN;

async function testAudioEndpoint(name, url) {
    console.log(`\n--- Testing ${name} ---`);
    console.log(`URL: ${url}`);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${TOKEN}`,
                "Content-Type": "audio/wav" // Sending raw bytes
            },
            body: wavHeader
        });

        console.log(`Status: ${response.status} - ${response.statusText}`);
        const txt = await response.text();
        console.log("Body:", txt.substring(0, 200));

        if (response.status === 200) return true;

        // If 400 or 422, it means it REACHED the model but complained about data (Success for connection)
        if (response.status === 400 || response.status === 422 || response.status === 500 || response.status === 503) {
            console.log("✅ CONTACT! Endpoint exists (just rejected mock data or loading).");
            return true;
        }

        return false;
    } catch (e) {
        console.log(`❌ EXCEPTION: ${e.message}`);
        return false;
    }
}

async function run() {
    // 1. Router Raw Model Endpoint
    await testAudioEndpoint(
        "Router Model Raw",
        "https://router.huggingface.co/models/openai/whisper-large-v3"
    );

    // 2. Router API-Inference Prefix
    await testAudioEndpoint(
        "Router HF-Inference",
        "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3"
    );

    // 3. Old API Inference (Likely 410)
    await testAudioEndpoint(
        "Old API Inference",
        "https://api-inference.huggingface.co/models/openai/whisper-large-v3"
    );

    // 4. Distil-Whisper (Raw)
    await testAudioEndpoint(
        "Distil-Whisper Raw",
        "https://router.huggingface.co/models/distil-whisper/distil-large-v3"
    );

    // 5. Generic Audio Route (OpenAI Style) - Trying to force routing
    await testAudioEndpoint(
        "Generic Router Audio v1",
        "https://router.huggingface.co/v1/audio/transcriptions"
    );

    // 6. Qwen-Audio? (Just in case it handles ASR)
    await testAudioEndpoint(
        "Qwen-Audio-Chat (Raw)",
        "https://router.huggingface.co/models/Qwen/Qwen-Audio-Chat"
    );

    // 7. Whisper Turbo (New)
    await testAudioEndpoint(
        "Whisper Turbo",
        "https://router.huggingface.co/models/openai/whisper-large-v3-turbo"
    );

    // 8. Whisper Tiny (Low resource)
    await testAudioEndpoint(
        "Whisper Tiny",
        "https://router.huggingface.co/models/openai/whisper-tiny"
    );
}

run();
