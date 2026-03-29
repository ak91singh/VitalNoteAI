import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

export default function PrivacyPolicyScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>Privacy Policy</Text>
            </View>
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.lastUpdated}>Last Updated: January 2026</Text>

                <Text style={styles.sectionTitle}>1. Information Collection</Text>
                <Text style={styles.paragraph}>
                    We collect information you provide directly to us, such as when you create an account, update your profile, or use the audio recording & transcription features.
                </Text>

                <Text style={styles.sectionTitle}>2. Use of Audio Data</Text>
                <Text style={styles.paragraph}>
                    Audio recordings are temporarily processed to generate transcripts. We do not use your confidential patient audio data to train our primary models without explicit consent. Audio files are handled with strict confidentiality.
                </Text>

                <Text style={styles.sectionTitle}>3. HIPAA Compliance</Text>
                <Text style={styles.paragraph}>
                    VitalNote AI is designed to support HIPAA-compliant workflows. We utilize encryption for data at rest and in transit. However, users are the "Covered Entities" and are responsible for ensuring their use of the app complies with their organizational policies.
                </Text>

                <Text style={styles.sectionTitle}>4. Data Retention</Text>
                <Text style={styles.paragraph}>
                    You have control over your data. You may delete notes and sessions at any time. Deleted data is removed from our active databases.
                </Text>

                <Text style={styles.sectionTitle}>5. Contact Us</Text>
                <Text style={styles.paragraph}>
                    If you have any questions about this Privacy Policy, please contact us at support@vitalnote.ai.
                </Text>
            </ScrollView>
            <View style={styles.footer}>
                <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
                    Close
                </Button>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        padding: 24,
        paddingBottom: 10,
        backgroundColor: theme.colors.surface,
        elevation: 2,
    },
    title: {
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    lastUpdated: {
        fontSize: 14,
        color: '#888',
        marginBottom: 16,
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        color: '#333',
    },
    paragraph: {
        fontSize: 16,
        lineHeight: 24,
        color: '#555',
        marginBottom: 16,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: theme.colors.surface,
    },
    button: {
        borderRadius: 8,
    }
});
