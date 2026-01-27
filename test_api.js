
// Native fetch is available in Node 18+

const TOKEN = "YOUR_HUGGING_FACE_TOKEN"; // Using the User's Token from Config

async function testEndpoint(name, url, method, body) {
    console.log(`\n--- Testing ${name} ---`);
    console.log(`URL: ${url}`);
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Authorization": `Bearer ${TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            console.log(`✅ SUCCESS! Status: ${response.status}`);
            const json = await response.json();
            console.log("Response Snippet:", JSON.stringify(json).substring(0, 100));
            return true;
        } else {
            console.log(`❌ FAILED. Status: ${response.status} - ${response.statusText}`);
            const err = await response.text();
            console.log("Error Body:", err.substring(0, 300)); // Log more
            return false;
        }
    } catch (e) {
        console.log(`❌ EXCEPTION: ${e.message}`);
        return false;
    }
}

async function run() {
    // 1. Qwen 2.5 on Base Router
    await testEndpoint(
        "Qwen 2.5 (Router V1)",
        "https://router.huggingface.co/v1/chat/completions",
        "POST",
        {
            model: "Qwen/Qwen2.5-7B-Instruct",
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 10
        }
    );

    // 2. Llama 3 on Base Router
    await testEndpoint(
        "Llama 3 (Router V1)",
        "https://router.huggingface.co/v1/chat/completions",
        "POST",
        {
            model: "meta-llama/Meta-Llama-3-8B-Instruct",
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 10
        }
    );

    // 3. Fallback: Old Inference API (Just to confirm it's DEAD)
    await testEndpoint(
        "Old API (Zephyr)",
        "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta/v1/chat/completions",
        "POST",
        {
            model: "HuggingFaceH4/zephyr-7b-beta",
            messages: [{ role: "user", content: "Hi" }]
        }
    );
}

run();
