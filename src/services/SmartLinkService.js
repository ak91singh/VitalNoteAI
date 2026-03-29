
// Common medications lookup for high-precision matching
const COMMON_MEDS = new Set([
    'aspirin', 'metformin', 'lisinopril', 'amoxicillin', 'atorvastatin',
    'levothyroxine', 'amlodipine', 'metoprolol', 'omeprazole', 'losartan',
    'gabapentin', 'simvastatin', 'hydrocodone', 'meloxicam', 'sertraline',
    'furosemide', 'pantoprazole', 'acetaminophen', 'prednisone', 'ibuprofen',
    'insulin', 'albuterol', 'cetirizine', 'fluticasone', 'doxycycline'
]);

export const SmartLinkService = {
    linkify(text) {
        if (!text) return "";

        // STRATEGY: Robust Tokenization
        // Split by anything that isn't a word character. 
        // Capturing group (...) ensures the delimiters are kept in the array.
        // matches: ["", "Note", ": ", "Patient", " ", "took", " ", "Aspirin", "."]
        const tokens = text.split(/([a-zA-Z0-9\u00C0-\u00FF]+)/);

        const drugSuffixRegex = /\w+(ol|statin|pril|sartan|cillin|mycin|vir|pine|ide|one)$/i;

        const processed = tokens.map(token => {
            // If token is just delimiters/whitespace, return as is
            if (!/[a-zA-Z0-9]/.test(token)) return token;

            const lowerWord = token.toLowerCase();
            if (token.length < 4) return token; // Skip short words

            let isMed = false;

            // 1. Direct Lookup
            if (COMMON_MEDS.has(lowerWord)) isMed = true;

            // 2. Suffix Check (Capitalized only, to adhere to Proper Noun conventions for many drugs, 
            // OR if it's a very clear match)
            if (!isMed) {
                // Heuristic: If it looks like a drug suffix AND is either capitalized or long enough
                if (drugSuffixRegex.test(token)) {
                    // Reduce false positives for common words ending in 'one' (e.g. "phone", "bone")
                    // We only accept suffixes if they are Capitalized (likely a Brand/Generic name start) 
                    // or strictly on our whitelist? 
                    // Let's stick to the Capitalization rule OR strict suffix logic.
                    if (/^[A-Z]/.test(token)) {
                        isMed = true;
                    }
                }
            }

            if (isMed) {
                return `[${token}](https://www.drugs.com/search.php?searchterm=${token})`;
            }

            return token;
        });

        return processed.join('');
    }
};
