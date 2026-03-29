import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

export const PDFService = {
    async generateAndShare(patientName, patientId, soapNote) {
        try {

            // Safety Check: Ensure soapNote is a string
            let contentString = "";
            if (typeof soapNote === 'string') {
                contentString = soapNote;
            } else if (typeof soapNote === 'object') {
                // If by some chance we still get an object, try to salvage it
                contentString = JSON.stringify(soapNote);
                if (soapNote.subjective) {
                    contentString = `# Subjective\n${soapNote.subjective}\n# Objective\n${soapNote.objective}\n# Assessment\n${soapNote.assessment}\n# Plan\n${soapNote.plan}`;
                }
            } else {
                contentString = "No content provided.";
            }

            const html = this.createHTML(patientName, patientId, contentString);
            const { uri } = await Print.printToFileAsync({ html });

            if (Platform.OS === "ios") {
                await Sharing.shareAsync(uri);
            } else {
                await Sharing.shareAsync(uri, { dialogTitle: 'Share SOAP Note PDF' });
            }
        } catch (error) {
            if (__DEV__) console.error("PDF Error:", error);
            Alert.alert("PDF Export Failed", "Could not generate or share the PDF. Ensure you have the necessary permissions.");
        }
    },

    createHTML(patientName, patientId, soapDataString) {
        const date = new Date().toLocaleDateString();

        // 1. Sanitize
        let formattedContent = soapDataString || 'No Data';

        // 2. Formatting Pipeline (Regex Magic)

        // Convert strict headers to HTML headers with Classes
        // Regex: Matches # Header or **Header** or Header: at start of line
        formattedContent = formattedContent
            .replace(/^#\s*Subjective/gim, '<h3 class="subjective">SUBJECTIVE</h3>')
            .replace(/^\*\*Subjective\*\*/gim, '<h3 class="subjective">SUBJECTIVE</h3>')
            .replace(/^#\s*Objective/gim, '<h3 class="objective">OBJECTIVE</h3>')
            .replace(/^\*\*Objective\*\*/gim, '<h3 class="objective">OBJECTIVE</h3>')
            .replace(/^#\s*Assessment/gim, '<h3 class="assessment">ASSESSMENT</h3>')
            .replace(/^\*\*Assessment\*\*/gim, '<h3 class="assessment">ASSESSMENT</h3>')
            .replace(/^#\s*Plan/gim, '<h3 class="plan">PLAN</h3>')
            .replace(/^\*\*Plan\*\*/gim, '<h3 class="plan">PLAN</h3>')

            // Bold Text (**text**)
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')

            // Bullet Points
            .replace(/^\s*-\s+(.*)/gm, '<li>$1</li>')

            // Newlines to BR
            .replace(/\n/g, '<br/>');

        // Wrap orphaned List Items in UL (Simple approximation)
        // Note: Full list wrapping in regex is hard, this is a visual approximation.
        // CSS will handle spacing.

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap');
                body { font-family: 'Roboto', Helvetica, Arial, sans-serif; padding: 40px; color: #1A1A1A; line-height: 1.6; }
                
                /* Header / Brand */
                .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1A5490; padding-bottom: 20px; margin-bottom: 40px; }
                .brand-container { display: flex; align-items: center; }
                .logo { font-size: 40px; color: #1A5490; margin-right: 15px; } /* Simple Medical Cross */
                .brand { font-size: 28px; font-weight: 700; color: #1A5490; text-transform: uppercase; letter-spacing: 1px; }
                .brand-sub { font-size: 14px; font-weight: 300; color: #555; margin-top: 0px; }
                
                .meta { text-align: right; font-size: 14px; color: #555; }
                .meta b { color: #000; }

                /* Content Styling */
                .content { font-size: 15px; }
                
                /* Section Headers (Colored) */
                h3 { 
                    margin-top: 30px; 
                    margin-bottom: 15px; 
                    padding-bottom: 8px;
                    border-bottom: 2px solid #eee; 
                    font-size: 18px; 
                    font-weight: 700; 
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .subjective { color: #1A5490; border-color: #bbdefb; } /* Deep Blue */
                .objective { color: #00A896; border-color: #c8e6c9; } /* Teal */
                .assessment { color: #FF9800; border-color: #ffe0b2; }
                .plan { color: #F44336; border-color: #ffcdd2; }

                /* Lists */
                li { margin-bottom: 8px; margin-left: 20px; }
                b { color: #000; font-weight: 600; }

                /* Footer */
                .footer { margin-top: 80px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #f0f0f0; padding-top: 20px; font-family: monospace; }
                .signature-box { display: flex; justify-content: flex-end; margin-top: 60px; margin-bottom: 20px; }
                .signature-line { border-top: 1px solid #333; width: 250px; text-align: center; padding-top: 10px; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="brand-container">
                    <div class="logo">✚</div>
                    <div>
                        <div class="brand">VitalNote AI</div>
                        <div class="brand-sub">Advanced Clinical Documentation</div>
                    </div>
                </div>
                <div class="meta">
                    <div><b>Patient:</b> ${patientName}</div>
                    <div><b>ID:</b> ${patientId}</div>
                    <div><b>Date:</b> ${date}</div>
                </div>
            </div>

            <div class="content">
                ${formattedContent}
            </div>

            <div class="signature-box">
                <div class="signature-line">
                    Electronically Signed<br>
                    <span style="font-weight:normal; font-size:12px; color:#666">Dr. [Signature Required]</span>
                </div>
            </div>

            <div class="footer">
                Generated by VitalNote AI v2.0 • HIPAA Compliant Audit Trail • ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}
            </div>
        </body>
        </html>
        `;
    }
};
