const TOKEN = "YOUR_HUGGING_FACE_TOKEN";
const ENDPOINT = "https://m5qwx9isfucjasw6.us-east-1.aws.endpoints.huggingface.cloud";

async function callDedicatedTextGen(prompt) {
    console.log("Sending request...");
    const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 512,
                return_full_text: false,
                temperature: 0.2,
                repetition_penalty: 1.3,
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
    return Array.isArray(result) ? result[0].generated_text : result.generated_text;
}

const transcript = "The patient is a 32 year old female who presents to urgent care today complaining of a three day history of sore throat associated with subjective fevers up to 101 degrees Fahrenheit last night. The patient denies any other symptoms including rhinorrhea or nasal congestion, headache, nausea, vomiting, diarrhoea, abdominal cramps, myalgia, arthralgia, skin changes such as maculopapular lesions, pruritus, urticaria, angioedema, dyspnoea, wheezing, orthostatic hypotension, syncope.";

const prompt = `[INST]
You are an expert medical scribe. Convert the transcript into a professional SOAP Note.
Rules:
1. Use [SUBJECTIVE], [OBJECTIVE], [ASSESSMENT], [PLAN] headers.
2. Use BULLET POINTS for every section.
3. Be CONCISE. Do not list normal findings for body parts mentioned in passing.
4. ONLY document information explicitly stated in the transcript. Do not halluciation exams (e.g. do not invent Genitourinary exams).

Example 1:
Transcript: "Patient has a sore throat and fever of 101 since yesterday."
SOAP Note:
[SUBJECTIVE]:
- Patient reports sore throat.
- Fever (101 F) started yesterday.

[OBJECTIVE]:
- Exams pending.

[ASSESSMENT]:
- Possible viral pharyngitis.

[PLAN]:
- Rest and fluids.
- Monitor temperature.

Example 2:
Transcript: "50-year-old male with chest pain. BP 150/90. No history of heart disease. Pain is non-radiating. Lungs clear."
SOAP Note:
[SUBJECTIVE]:
- 50yo male with chest pain.
- Pain is non-radiating.
- Denies history of heart disease.

[OBJECTIVE]:
- BP 150/90.
- Lungs clear.

[ASSESSMENT]:
- Chest pain, hypertension.
- Low suspicion for ACS.

[PLAN]:
- EKG.
- Cardiac Enzymes.
- Observation.

Actual Input:
Transcript: "${transcript}"
SOAP Note:
[/INST]
[SUBJECTIVE]:`;

console.log("Prompt End:\n", prompt.substring(prompt.length - 200));

async function run() {
    try {
        const output = await callDedicatedTextGen(prompt);
        console.log("\n--- OUTPUT ---\n");
        console.log("[SUBJECTIVE]:" + output); // Mimic manual append
        console.log("\n--- END OUTPUT ---\n");
    } catch (e) {
        console.error(e);
    }
}

run();
