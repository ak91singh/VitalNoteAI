
const TOKEN = "YOUR_HUGGING_FACE_TOKEN";

const CANDIDATES = [
    { name: "GPT-2", id: "gpt2", type: "text" },
    { name: "Flan T5 Base", id: "google/flan-t5-base", type: "text" },
    { name: "Qwen 2.5 7B", id: "Qwen/Qwen2.5-7B-Instruct", type: "chat" }
];

async function test(candidate) {
    console.log(`\n🔎 Testing ${candidate.name} (${candidate.id})...`);

    // Pattern 1: Chat Completions (v1/chat/completions)
    // Only for "chat" types
    if (candidate.type === "chat") {
        const url = `https://router.huggingface.co/models/${candidate.id}/v1/chat/completions`;
        const body = {
            model: candidate.id,
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 10
        };
        await tryRequest(url, body, "Chat Endpoint");
    }

    // Pattern 2: Text Completions (v1/completions)
    // Good for "text" types or older chat models
    const url2 = `https://router.huggingface.co/models/${candidate.id}/v1/completions`;
    const body2 = {
        model: candidate.id,
        prompt: "Hello",
        max_tokens: 10
    };
    await tryRequest(url2, body2, "Legacy Completion Endpoint");

    // Pattern 3: Root Inference (Raw)
    const url3 = `https://router.huggingface.co/models/${candidate.id}`;
    const body3 = {
        inputs: "Hello",
        parameters: { max_new_tokens: 10 }
    };
    await tryRequest(url3, body3, "Root Inference Endpoint");
}

async function tryRequest(url, body, label) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            console.log(`   ✅ [${label}] SUCCESS (200 OK)`);
        } else {
            console.log(`   ❌ [${label}] FAILED (${res.status}): ${res.statusText}`);
            if (res.status === 400) {
                const txt = await res.text();
                console.log(`      Error: ${txt.substring(0, 100)}`);
            }
        }
    } catch (e) {
        console.log(`   ⚠️ [${label}] EXCEPTION: ${e.message}`);
    }
}

async function run() {
    for (const c of CANDIDATES) {
        await test(c);
    }
}

run();
