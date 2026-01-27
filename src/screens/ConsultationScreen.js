import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, ActivityIndicator, TextInput, Card, IconButton, useTheme } from 'react-native-paper';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AIService } from '../services/aiService';
import { CONSULTATION_TEMPLATES } from '../constants/templates';

export default function ConsultationScreen({ navigation }) {
    const theme = useTheme();

    // State
    const [recording, setRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioUri, setAudioUri] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, recording, processing_stt, processing_llm, done
    const [transcript, setTranscript] = useState('');
    const [soapNote, setSoapNote] = useState('');
    const [duration, setDuration] = useState(0);
    const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
    const [selectedTemplateId, setSelectedTemplateId] = useState('general');

    // Timer for recording
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        } else if (!isRecording && status === 'idle') {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [isRecording, status]);

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission needed', 'Microphone access is required to record consultations.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
            setStatus('recording');
            setAudioUri(null);
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Could not start recording.');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setStatus('idle');
        setIsRecording(false);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setAudioUri(uri);
        setRecording(null);
    };

    const processConsultation = async () => {
        if (!audioUri) return;

        try {
            // 1. Transcribe
            setStatus('processing_stt');
            const text = await AIService.transcribeAudio(audioUri);
            setTranscript(text);

            // 2. Generate SOAP
            setStatus('processing_llm');
            // Find full template object or pass ID
            const templateObj = CONSULTATION_TEMPLATES.find(t => t.id === selectedTemplateId);
            const soap = await AIService.generateSOAP(text, templateObj);
            setSoapNote(soap);

            setStatus('done');
        } catch (error) {
            setStatus('idle');
            Alert.alert('Processing Error', error.message);
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>New Consultation</Text>
                        <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>AI Scribe Active</Text>
                    </View>

                    {/* Template Selector */}
                    <View style={{ marginBottom: 20 }}>
                        <Text variant="titleSmall" style={{ marginBottom: 10 }}>Select Specialty</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            {CONSULTATION_TEMPLATES.map((tmpl) => (
                                <Button
                                    key={tmpl.id}
                                    mode={selectedTemplateId === tmpl.id ? "contained" : "outlined"}
                                    onPress={() => setSelectedTemplateId(tmpl.id)}
                                    compact
                                >
                                    {tmpl.name}
                                </Button>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Mode Switcher */}
                    <View style={styles.modeSwitch}>
                        <Button
                            mode={inputMode === 'voice' ? "contained" : "outlined"}
                            onPress={() => setInputMode('voice')}
                            style={styles.modeButton}
                        >
                            Record Audio
                        </Button>
                        <Button
                            mode={inputMode === 'text' ? "contained" : "outlined"}
                            onPress={() => setInputMode('text')}
                            style={styles.modeButton}
                        >
                            Dictation / Type
                        </Button>
                    </View>

                    {inputMode === 'voice' ? (
                        <Card style={styles.card} mode="elevated">
                            <Card.Content style={styles.recordingContainer}>
                                <View style={styles.timerContainer}>
                                    <Text variant="displaySmall" style={{ fontVariant: ['tabular-nums'] }}>
                                        {formatDuration(duration)}
                                    </Text>
                                </View>

                                {isRecording ? (
                                    <Button
                                        mode="contained"
                                        onPress={stopRecording}
                                        style={styles.recordButton}
                                        buttonColor={theme.colors.error}
                                        icon="stop"
                                    >
                                        Stop Recording
                                    </Button>
                                ) : (
                                    <Button
                                        mode="contained"
                                        onPress={startRecording}
                                        style={styles.recordButton}
                                        buttonColor={theme.colors.error}
                                        icon="microphone"
                                        disabled={status.startsWith('processing')}
                                    >
                                        Start Recording
                                    </Button>
                                )}

                                {/* Note about file upload/transcription */}
                                {audioUri && !isRecording && (
                                    <Text style={{ marginTop: 10, fontSize: 12, color: 'gray' }}>
                                        *Audio will be processed using secure AI.
                                    </Text>
                                )}

                                {audioUri && !isRecording && (
                                    <Button
                                        mode="contained"
                                        onPress={processConsultation}
                                        style={{ marginTop: 16 }}
                                        icon="auto-fix"
                                    >
                                        Generate SOAP Note
                                    </Button>
                                )}
                            </Card.Content>
                        </Card>
                    ) : (
                        <Card style={styles.card}>
                            <Card.Content>
                                <Text variant="titleSmall" style={{ marginBottom: 8 }}>
                                    Use your keyboard's microphone (🎙️) to dictate notes here, then click Generate.
                                </Text>
                                <TextInput
                                    mode="outlined"
                                    multiline
                                    placeholder="Patient specifics, symptoms, observations..."
                                    value={transcript}
                                    onChangeText={setTranscript}
                                    style={{ minHeight: 150, backgroundColor: 'white' }}
                                />
                                <Button
                                    mode="contained"
                                    onPress={() => {
                                        setStatus('processing_llm');
                                        const templateObj = CONSULTATION_TEMPLATES.find(t => t.id === selectedTemplateId);
                                        AIService.generateSOAP(transcript, templateObj).then(note => {
                                            setSoapNote(note);
                                            setStatus('done');
                                        }).catch(e => {
                                            setStatus('idle');
                                            Alert.alert("Error", e.message);
                                        });
                                    }}
                                    style={{ marginTop: 16 }}
                                    icon="auto-fix"
                                    disabled={!transcript}
                                >
                                    Generate SOAP Note
                                </Button>
                            </Card.Content>
                        </Card>
                    )}

                    {/* Processing Status */}
                    {(status === 'processing_stt' || status === 'processing_llm') && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" animating={true} color={theme.colors.primary} />
                            <Text style={{ marginTop: 16 }}>
                                {status === 'processing_stt' ? 'Transcribing (this may take a moment)...' : 'Analyzing with Qwen AI...'}
                            </Text>
                        </View>
                    )}

                    {/* Results */}
                    {status === 'done' && (
                        <View style={styles.resultsContainer}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>Generated SOAP Note</Text>
                            <TextInput
                                mode="outlined"
                                multiline
                                value={soapNote}
                                onChangeText={setSoapNote}
                                style={[styles.soapInput, { minHeight: 300 }]}
                            />

                            <Button mode="contained" style={{ marginTop: 24 }} onPress={() => navigation.navigate('Dashboard')}>
                                Save to Patient Record
                            </Button>
                        </View>
                    )}

                    {/* Disclaimer Footer */}
                    <Text style={styles.disclaimer}>
                        IMPORTANT: This tool uses AI to assist with documentation. It is not a substitute for professional medical judgment.
                        Review all output for accuracy before saving. Do not enter PII/PHI in this demo version.
                    </Text>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 24,
    },
    modeSwitch: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 10,
    },
    modeButton: {
        flex: 1,
    },
    card: {
        backgroundColor: 'white',
        marginBottom: 24,
    },
    recordingContainer: {
        alignItems: 'center',
        padding: 16,
    },
    timerContainer: {
        marginBottom: 24,
    },
    recordButton: {
        width: 200,
        borderRadius: 50,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 32,
    },
    resultsContainer: {
        marginTop: 0,
    },
    sectionTitle: {
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
    },
    soapInput: {
        backgroundColor: 'white',
    },
    disclaimer: {
        marginTop: 32,
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic',
    }
});
