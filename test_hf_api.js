const fetch = require('node-fetch');

const TOKEN = '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';
const MODELS = [
    'BioMistral/BioMistral-7B', // Target
    'mistralai/Mistral-7B-Instruct-v0.3', // Fallback 1
    'Qwen/Qwen2.5-7B-Instruct' // Fallback 2
];

async function testModel(model) {
    const url = `https://api-inference.huggingface.co/models/${model}`;
    console.log(`Testing ${model}...`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: "Hello, are you a doctor?" })
        });

        if (response.ok) {
            console.log(`✅ ${model} is WORKING!`);
            const json = await response.json();
            console.log('Response:', JSON.stringify(json).substring(0, 100) + '...');
        } else {
            console.log(`❌ ${model} failed: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log('Error:', text);
        }
    } catch (e) {
        console.log(`❌ ${model} error:`, e.message);
    }
    console.log('---');
}

async function run() {
    for (const model of MODELS) {
        await testModel(model);
    }
}

run();
