import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, ActivityIndicator, TextInput, Card, IconButton, useTheme, Divider } from 'react-native-paper';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AIService } from '../services/aiService';
import { PDFService } from '../services/pdfService';

export default function ConsultationScreen({ navigation, route }) {
    const theme = useTheme();
    const { patientName, patientId, template } = route.params || {};

    // State
    const [recording, setRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioUri, setAudioUri] = useState(null);
    const [status, setStatus] = useState('idle');
    const [transcript, setTranscript] = useState('');

    // Single Blob State - The Source of Truth
    const [soapNote, setSoapNote] = useState('');
    const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'edit'

    const [duration, setDuration] = useState(0);
    const [inputMode, setInputMode] = useState('voice');

    // Timer
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
                Alert.alert('Permission needed', 'Microphone access is required.');
                return;
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(recording);
            setIsRecording(true);
            setStatus('recording');
            setAudioUri(null);
        } catch (err) {
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
        if (!audioUri && !transcript) return;

        try {
            // 1. Transcribe
            let currentTranscript = transcript;
            if (audioUri) {
                setStatus('processing_stt');
                currentTranscript = await AIService.transcribeAudio(audioUri);
                setTranscript(currentTranscript);
            }

            // 2. Generate SOAP
            setStatus('processing_llm');
            // We expect a raw string from AI Service
            const rawSoap = await AIService.generateSOAP(currentTranscript, template);

            // 3. Set Result
            setSoapNote(rawSoap);
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

    // --- Rich Text Renderer ---
    // Parses lines to find Headers and colors them.
    const MedicalMarkdownView = ({ text }) => {
        if (!text) return <Text>No data generated.</Text>;

        // Safety check for non-strings
        const safeText = typeof text === 'string' ? text : JSON.stringify(text);

        const lines = safeText.split('\n');
        return (
            <View>
                {lines.map((line, index) => {
                    const trimmed = line.trim();
                    // Detect Headers: # Header, **Header**, or Header:

                    let isHeader = false;
                    let color = '#333';
                    let content = line;

                    // Regex to find headers
                    const headerMatch = trimmed.match(/^#\s+(.*)|^\*\*([A-Za-z\s]+)\*\*|^([A-Za-z\s]+):$/);

                    if (headerMatch) {
                        const title = (headerMatch[1] || headerMatch[2] || headerMatch[3] || "").toLowerCase();
                        // Only treat standard SOAP sections as Big Colored Headers
                        if (title.includes('subjective') || title.includes('objective') || title.includes('assessment') || title.includes('plan')) {
                            isHeader = true;
                            if (title.includes('subjective')) color = '#2196F3'; // Blue
                            else if (title.includes('objective')) color = '#4CAF50'; // Green
                            else if (title.includes('assessment')) color = '#FF9800'; // Orange
                            else if (title.includes('plan')) color = '#F44336'; // Red

                            content = (headerMatch[1] || headerMatch[2] || headerMatch[3]).toUpperCase();
                        }
                    }

                    if (isHeader) {
                        return (
                            <Text key={index} style={{ color: color, fontWeight: 'bold', fontSize: 18, marginTop: 16, marginBottom: 8, letterSpacing: 1 }}>
                                {content}
                            </Text>
                        );
                    } else {
                        // Regular body text - check for bolding inside
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        return (
                            <Text key={index} style={{ fontSize: 16, lineHeight: 24, color: '#333', marginBottom: 4 }}>
                                {parts.map((part, i) => {
                                    if (part.startsWith('**') && part.endsWith('**')) {
                                        return <Text key={i} style={{ fontWeight: 'bold' }}>{part.slice(2, -2)}</Text>;
                                    }
                                    return <Text key={i}>{part}</Text>;
                                })}
                            </Text>
                        );
                    }
                })}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    {/* Header Info */}
                    <View style={styles.header}>
                        <Text variant="titleMedium" style={{ color: theme.colors.secondary }}>Patient: {patientName || 'Unknown'}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>Template: {template?.name || 'General'}</Text>
                    </View>

                    {/* Status Feedback */}
                    {status === 'processing_stt' && <ActivityIndicator animating={true} color={theme.colors.primary} size="large" />}
                    {status === 'processing_llm' && <ActivityIndicator animating={true} color={theme.colors.error} size="large" />}

                    {/* Input Area (Hidden when done) */}
                    {status !== 'done' && (
                        <Card style={styles.inputCard}>
                            <Card.Content>
                                {inputMode === 'voice' ? (
                                    <View style={{ alignItems: 'center' }}>
                                        <Text variant="displaySmall" style={{ marginBottom: 16 }}>{formatDuration(duration)}</Text>
                                        {isRecording ? (
                                            <Button mode="contained" onPress={stopRecording} buttonColor={theme.colors.error}>Stop Recording</Button>
                                        ) : (
                                            <Button mode="contained" onPress={startRecording} disabled={!!audioUri}>
                                                {audioUri ? 'Audio Recorded' : 'Start Recording'}
                                            </Button>
                                        )}
                                    </View>
                                ) : (
                                    <TextInput
                                        mode="outlined"
                                        multiline
                                        placeholder="Type notes here..."
                                        value={transcript}
                                        onChangeText={setTranscript}
                                        style={{ minHeight: 100 }}
                                    />
                                )}
                                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
                                    <Button mode="text" onPress={() => setInputMode(inputMode === 'voice' ? 'text' : 'voice')}>
                                        Switch to {inputMode === 'voice' ? 'Type' : 'Voice'}
                                    </Button>
                                </View>
                            </Card.Content>
                            <Card.Actions>
                                <Button
                                    mode="contained"
                                    onPress={processConsultation}
                                    style={{ flex: 1 }}
                                    disabled={(!audioUri && !transcript) || isRecording}
                                >
                                    Generate Note
                                </Button>
                            </Card.Actions>
                        </Card>
                    )}

                    {/* Results Area - Single Unified Card */}
                    {status === 'done' && (
                        <View style={styles.resultsContainer}>
                            <Card style={styles.card} mode="elevated">
                                <Card.Title
                                    title="Clinical Analysis"
                                    right={(props) => (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                                            <Text style={{ fontSize: 12, marginRight: 8, color: '#666', fontWeight: 'bold' }}>{viewMode === 'preview' ? 'READING MODE' : 'EDIT MODE'}</Text>
                                            <IconButton {...props} icon={viewMode === 'preview' ? "pencil" : "check"} onPress={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')} />
                                        </View>
                                    )}
                                />
                                <Divider />
                                <Card.Content style={{ paddingTop: 16 }}>
                                    {viewMode === 'preview' ? (
                                        <MedicalMarkdownView text={soapNote} />
                                    ) : (
                                        <TextInput
                                            mode="flat"
                                            multiline
                                            value={soapNote}
                                            onChangeText={setSoapNote}
                                            style={{ backgroundColor: '#f9f9f9', fontSize: 16, minHeight: 300 }}
                                            underlineColor="transparent"
                                        />
                                    )}
                                </Card.Content>
                            </Card>

                            <View style={styles.actionButtons}>
                                <Button
                                    mode="contained"
                                    icon="file-pdf-box"
                                    onPress={() => {
                                        console.log("Exporting PDF with data:", soapNote);
                                        // Pass the single string note
                                        PDFService.generateAndShare(patientName, patientId, soapNote);
                                    }}
                                    style={{ flex: 1, marginRight: 8, backgroundColor: '#E91E63' }}
                                >
                                    Export PDF
                                </Button>
                                <Button
                                    mode="contained"
                                    icon="check"
                                    onPress={() => navigation.navigate('Dashboard')}
                                    style={{ flex: 1, backgroundColor: theme.colors.primary }}
                                >
                                    Save & Close
                                </Button>
                            </View>
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    content: { padding: 16, paddingBottom: 40 },
    header: { marginBottom: 16, alignItems: 'center' },
    inputCard: { marginBottom: 24, backgroundColor: 'white' },
    card: { marginBottom: 12, backgroundColor: 'white' },
    resultsContainer: { marginTop: 10 },
    actionButtons: { flexDirection: 'row', marginTop: 24, paddingBottom: 20 }
});
