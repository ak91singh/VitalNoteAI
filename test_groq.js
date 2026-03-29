const CONFIG = {
    GROQ_API_KEY: "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"
};

const MODELS = [
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768"
];

async function testGroq(model) {
    console.log(`Testing Groq model: ${model}...`);
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${CONFIG.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: "You are a doctor." },
                    { role: "user", content: "Hello, what is a fever?" }
                ]
            })
        });

        console.log(`Status: ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            console.log("✅ GROQ WORKS!");
            console.log("Response:", data.choices[0].message.content.substring(0, 100) + "...");
            return model;
        } else {
            const text = await response.text();
            console.log(`❌ GROQ ERROR: ${text}`);
            return null;
        }
    } catch (e) {
        console.log(`❌ EXCEPTION: ${e.message}`);
        return null;
    }
}

async function run() {
    for (const model of MODELS) {
        const result = await testGroq(model);
        if (result) {
            console.log(`🏆 FOUND WORKING MODEL: ${result}`);
            break;
        }
    }
}

run();
