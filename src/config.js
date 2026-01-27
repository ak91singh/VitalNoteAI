export const CONFIG = {
    MEDITRON_API_TOKEN: "YOUR_HUGGING_FACE_TOKEN",
    GROQ_API_KEY: "", // GET FREE KEY: https://console.groq.com/keys
    // Dedicated Endpoint (Paid/Custom). Uncomment to use.
    // DEDICATED_ENDPOINT_URL: "https://m5qwx9isfucjasw6.us-east-1.aws.endpoints.huggingface.cloud",
    DEDICATED_ENDPOINT_URL: "",

    // Free Public Router Models
    // Qwen 2.5 is SOTA for 7B size and works on the free router.
    PRIMARY_MODEL_ID: "Qwen/Qwen2.5-7B-Instruct",
    FALLBACK_MODEL_ID: "HuggingFaceH4/zephyr-7b-beta",
    // Base URL structure: https://router.huggingface.co/v1/chat/completions
    HF_INFERENCE_BASE: "https://router.huggingface.co/v1/",
};
