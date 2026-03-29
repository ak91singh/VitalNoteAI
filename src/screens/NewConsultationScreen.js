import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Text, TextInput, Button, Card, useTheme, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONSULTATION_TEMPLATES } from '../constants/templates';

export default function NewConsultationScreen({ navigation }) {
    const theme = useTheme();
    const [patientName, setPatientName] = useState('');
    const [patientId, setPatientId] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('general');

    const handleStart = () => {
        const template = CONSULTATION_TEMPLATES.find(t => t.id === selectedTemplateId);
        navigation.navigate('Consultation', {
            patientName: patientName || 'Unknown Patient',
            patientId: patientId || 'N/A',
            template: template
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.header}>
                    <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.primary }]}>
                        New Consultation
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>
                        Enter details to configure the AI scribe.
                    </Text>
                </View>

                {/* Patient Details Section */}
                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Patient Information</Text>
                        <TextInput
                            label="Patient Name"
                            value={patientName}
                            onChangeText={setPatientName}
                            mode="outlined"
                            style={styles.input}
                            placeholder="e.g. John Doe"
                        />
                        <TextInput
                            label="Patient ID / MRN (Optional)"
                            value={patientId}
                            onChangeText={setPatientId}
                            mode="outlined"
                            style={styles.input}
                            placeholder="e.g. MRN-123456"
                        />
                    </Card.Content>
                </Card>

                {/* Template Selection Section */}
                <Card style={styles.card}>
                    <Card.Content>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Consultation Type</Text>
                        <Text variant="bodySmall" style={styles.helperText}>
                            Select a specialty to optimize the AI's medical terminology and format.
                        </Text>

                        <View style={styles.chipContainer}>
                            {CONSULTATION_TEMPLATES.map((tmpl) => (
                                <Chip
                                    key={tmpl.id}
                                    selected={selectedTemplateId === tmpl.id}
                                    onPress={() => setSelectedTemplateId(tmpl.id)}
                                    style={styles.chip}
                                    showSelectedOverlay
                                >
                                    {tmpl.name}
                                </Chip>
                            ))}
                        </View>
                    </Card.Content>
                </Card>

                <Button
                    mode="contained"
                    onPress={handleStart}
                    style={styles.startButton}
                    contentStyle={{ height: 50 }}
                    disabled={!patientName.trim()}
                >
                    Start Session
                </Button>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontWeight: 'bold',
    },
    card: {
        marginBottom: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Slight opacity for glassmorphism feel
    },
    sectionTitle: {
        marginBottom: 16,
        fontWeight: '600',
    },
    input: {
        marginBottom: 12,
        backgroundColor: '#ffffff',
    },
    helperText: {
        marginBottom: 12,
        color: '#666',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        marginBottom: 8,
    },
    startButton: {
        marginTop: 8,
        borderRadius: 8,
    }
});
