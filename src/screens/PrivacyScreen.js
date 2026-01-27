import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen({ route }) {
    const theme = useTheme();
    const type = route.params?.type || 'privacy';
    const isTerms = type === 'terms';

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text variant="headlineMedium" style={{ marginBottom: 20, color: theme.colors.primary, fontWeight: 'bold' }}>
                    {isTerms ? "Terms of Service" : "Privacy Policy"}
                </Text>

                {isTerms ? (
                    <>
                        <Text style={styles.paragraph}>
                            1. Acceptance of Terms: By using VitalNote AI, you agree to these terms.
                        </Text>
                        <Text style={styles.paragraph}>
                            2. Service Usage: This service provides AI-assisted documentation. It is NOT a replacement for medical judgment.
                        </Text>
                        <Text style={styles.paragraph}>
                            3. User Responsibility: You are responsible for verifying all generated notes.
                        </Text>
                        <Text style={styles.paragraph}>
                            4. Data Handling: We process data securely but do not guarantee 100% uptime.
                        </Text>
                    </>
                ) : (
                    <>
                        <Text style={styles.paragraph}>
                            1. Data Collection: We collect audio and text data only for the purpose of generating consultation notes.
                        </Text>
                        <Text style={styles.paragraph}>
                            2. Processing: Data is processed via secure APIs. We do not store PHI permanently in this version.
                        </Text>
                        <Text style={styles.paragraph}>
                            3. Third Parties: We use Meditron/HuggingFace for AI processing.
                        </Text>
                        <Text style={styles.paragraph}>
                            4. Security: Industry standard encryption is used.
                        </Text>
                    </>
                )}

                <Text style={{ marginTop: 40, fontStyle: 'italic', fontSize: 12 }}>
                    Last Updated: January 2026
                </Text>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 20,
    },
    paragraph: {
        fontSize: 16,
        marginBottom: 16,
        lineHeight: 24,
    }
});
