const MODEL = 'mistralai/Mistral-7B-Instruct-v0.2'; // UNGATED

async function testPipeline(url) {
    console.log(`Testing PIPELINE (No Token): ${url}`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                // 'Authorization': `Bearer ...`, // REMOVED
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: "Hello" })
        });
        console.log(`Status: ${response.status}`);
        if (response.ok) {
            console.log("✅ WORKS WITHOUT TOKEN!");
            return true;
        }
        console.log(await response.text());
        return false;
    } catch (e) {
        console.log(e.message);
        return false;
    }
}

async function run() {
    // 1. Try Ungated Pipeline on Router
    await testPipeline(`https://router.huggingface.co/models/${MODEL}`);

    // 2. Try API Inference Legacy (some keys work here?)
    await testPipeline(`https://api-inference.huggingface.co/models/${MODEL}`);
}

run();
