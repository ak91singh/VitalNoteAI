import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

export const PDFService = {
    async generateAndShare(patientName, patientId, soapNote) {
        try {
            console.log("PDFService received:", typeof soapNote);

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
            console.error("PDF Error:", error);
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
                body { font-family: 'Roboto', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                
                /* Header / Brand */
                .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0056b3; padding-bottom: 20px; margin-bottom: 40px; }
                .brand { font-size: 28px; font-weight: 700; color: #0056b3; text-transform: uppercase; letter-spacing: 1px; }
                .brand-sub { font-size: 14px; font-weight: 300; color: #666; margin-top: 5px; }
                .meta { text-align: right; font-size: 14px; color: #555; }
                .meta b { color: #000; }

                /* Content Styling */
                .content { font-size: 15px; }
                
                /* Section Headers (Colored) */
                h3 { 
                    margin-top: 30px; 
                    margin-bottom: 15px; 
                    padding-bottom: 8px;
                    border-bottom: 1px solid #eee; 
                    font-size: 18px; 
                    font-weight: 700; 
                    letter-spacing: 0.5px;
                }
                .subjective { color: #2196F3; border-color: #bbdefb; }
                .objective { color: #4CAF50; border-color: #c8e6c9; }
                .assessment { color: #FF9800; border-color: #ffe0b2; }
                .plan { color: #F44336; border-color: #ffcdd2; }

                /* Lists */
                li { margin-bottom: 5px; margin-left: 20px; }

                /* Footer */
                .footer { margin-top: 60px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #f0f0f0; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="brand">VitalNote AI</div>
                    <div class="brand-sub">Clinical Documentation System</div>
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

            <div class="footer">
                Electronically generated by VitalNote AI. This document serves as a preliminary clinical record. Verified by __________________________
            </div>
        </body>
        </html>
        `;
    }
};
