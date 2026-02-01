import React from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

export default function DisclaimerScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>Medical Disclaimer</Text>
            </View>
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                <Card style={styles.warningCard}>
                    <Card.Content>
                        <Text style={styles.warningTitle}>⚠️ IMPORTANT NOTICE</Text>
                        <Text style={styles.warningText}>
                            VitalNote AI is an implementation of Artificial Intelligence technology. AI models can occasionally produce incorrect information ("hallucinations").
                        </Text>
                    </Card.Content>
                </Card>

                <Text style={styles.sectionTitle}>Professional Use Only</Text>
                <Text style={styles.paragraph}>
                    This software is intended for use by licensed healthcare professionals only. It is designed to assist with documentation burden but DOES NOT replace professional medical judgment.
                </Text>

                <Text style={styles.sectionTitle}>Verification Required</Text>
                <Text style={styles.paragraph}>
                    You explicitly acknowledge that you must read, review, and verify every word of the generated SOAP note for clinical accuracy before signing off or adding it to a patient's medical record.
                </Text>

                <Text style={styles.sectionTitle}>No Liability</Text>
                <Text style={styles.paragraph}>
                    VitalNote AI and its developers assume no liability for errors, omissions, or inaccuracies in the generated documentation, nor for any clinical decisions made based on this documentation.
                </Text>
            </ScrollView>
            <View style={styles.footer}>
                <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
                    I Understand
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
        color: theme.colors.error, // Red for disclaimer
    },
    content: {
        flex: 1,
        padding: 24,
    },
    warningCard: {
        backgroundColor: '#FFF5F5',
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.error,
    },
    warningTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.error,
        marginBottom: 8,
    },
    warningText: {
        fontSize: 16,
        color: '#333',
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
