
const TOKEN = "YOUR_HUGGING_FACE_TOKEN";
const ENDPOINT = "https://m5qwx9isfucjasw6.us-east-1.aws.endpoints.huggingface.cloud";

async function testPath(label, path, body) {
    const url = path ? `${ENDPOINT}${path}` : ENDPOINT;
    console.log(`\n🔎 Testing ${label} -> ${url}`);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        console.log(`   Status: ${response.status} ${response.statusText}`);
        if (response.ok) {
            console.log(`   ✅ SUCCESS`);
            const json = await response.json();
            console.log("   Response:", JSON.stringify(json).substring(0, 100));
        } else {
            console.log(`   ❌ FAILED`);
            const txt = await response.text();
            console.log("   Error:", txt.substring(0, 100));
        }
    } catch (e) {
        console.log(`   ⚠️ EXCEPTION: ${e.message}`);
    }
}

async function run() {
    // 1. OpenAI Chat (What we are currently using)
    await testPath("OpenAI Chat Style", "/v1/chat/completions", {
        model: "tgi",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10
    });

    // 2. TGI Standard Generate
    await testPath("TGI /generate", "/generate", {
        inputs: "Patient presents with",
        parameters: { max_new_tokens: 10 }
    });

    // 3. TGI Root (Raw)
    await testPath("TGI Root", "", {
        inputs: "Patient presents with",
        parameters: { max_new_tokens: 10 }
    });
}

run();
