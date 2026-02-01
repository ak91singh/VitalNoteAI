import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

export default function TermsOfServiceScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>Terms of Service</Text>
            </View>
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
                <Text style={styles.paragraph}>
                    By accessing and using VitalNote AI, you accept and agree to be bound by the terms and provision of this agreement.
                </Text>

                <Text style={styles.sectionTitle}>2. Medical Disclaimer</Text>
                <Text style={styles.paragraph}>
                    VitalNote AI is an assistive documentation tool for healthcare professionals. It is NOT a diagnostic tool and does not provide medical advice. The generated content must be reviewed, verified, and approved by a licensed professional before being entered into any official medical record.
                </Text>

                <Text style={styles.sectionTitle}>3. User Responsibilities</Text>
                <Text style={styles.paragraph}>
                    You agree to use this application in compliance with all applicable laws, including HIPAA and other data privacy regulations. You are solely responsible for the accuracy of the patient data you input and the final documentation you produce.
                </Text>

                <Text style={styles.sectionTitle}>4. Data Handling</Text>
                <Text style={styles.paragraph}>
                    While we employ industry-standard encryption and security measures, you acknowledge that no method of transmission over the internet or electronic storage is 100% secure.
                </Text>

                <Text style={styles.sectionTitle}>5. Termination</Text>
                <Text style={styles.paragraph}>
                    We reserve the right to terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
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
