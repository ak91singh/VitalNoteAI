import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Linking, TouchableOpacity } from 'react-native';
import { Text, Button, ActivityIndicator, TextInput, Card, IconButton, useTheme, Divider, Switch, Menu } from 'react-native-paper';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgenticSOAPService } from '../services/AgenticSOAPService';
import { PDFService } from '../services/pdfService';
import { SecureStorageService, STORAGE_KEYS } from '../services/SecureStorageService';
import { SmartLinkService } from '../services/SmartLinkService';
import AudioVisualizer from '../components/AudioVisualizer';
import { auth } from '../services/firebase';
import { canGenerateNote, incrementNoteCount } from '../services/PlanManager';
import UpgradeModal, { shouldShowUpgradeModal } from '../components/UpgradeModal';

// Maps raw API error strings to clean one-liners shown in the "Quality Analysis Unavailable" card
function _friendlyAgentError(msg) {
    if (!msg) return 'Agentic pipeline unavailable — note generated via fallback.';
    if (msg.includes('429'))        return 'AI quota reached — note generated via fallback.';
    if (msg.includes('401') || msg.includes('403')) return 'AI service auth error — check API key.';
    if (msg.includes('500') || msg.includes('503')) return 'AI service temporarily unavailable.';
    return 'Agentic pipeline unavailable — note generated via fallback.';
}

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'de', label: 'German' },
    { code: 'fr', label: 'French' },
    { code: 'hi', label: 'Hindi' },
    { code: 'ta', label: 'Tamil' },
    { code: 'te', label: 'Telugu' },
];

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
    const [qualityMetrics, setQualityMetrics] = useState(null);       // Agentic quality metrics
    const [agentError,     setAgentError]     = useState(null);       // Why agentic pipeline failed (diagnostic)
    const [sessionTimeSaved,  setSessionTimeSaved]  = useState(0);   // Running total minutes saved this session
    const [sessionMoneySaved, setSessionMoneySaved] = useState(0);   // Running total $ value saved this session

    const [progressMessage, setProgressMessage] = useState('');
    const [progressStage,   setProgressStage]   = useState('');

    const [duration, setDuration] = useState(0);
    const [inputMode, setInputMode] = useState('voice');
    const [metering, setMetering] = useState(-160); // Decibels

    // ── Usage gate state ────────────────────────────────────────────────────
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // [PHASE 4 & 5] Enterprise Features
    const [isMultiSpeaker, setIsMultiSpeaker] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const [languageMenuVisible, setLanguageMenuVisible] = useState(false);

    // Timer
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        }
        // FIXED: Do NOT reset duration here, otherwise it is 0 when we generate the note!
        return () => clearInterval(interval);
    }, [isRecording]);

    const startRecording = async () => {
        try {
            // Check network before starting — transcription needs internet
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected || !networkState.isInternetReachable) {
                Alert.alert(
                    'No Internet Connection',
                    'You need an internet connection to transcribe and generate SOAP notes. Please check your connection and try again.',
                    [{ text: 'OK' }]
                );
                return;
            }

            // Show explanation before the system permission dialog (first-time only)
            const existingPerm = await Audio.getPermissionsAsync();
            if (existingPerm.status !== 'granted') {
                await new Promise((resolve) => {
                    Alert.alert(
                        'Microphone Access',
                        'VitalNoteAI needs microphone access to record patient consultations and generate SOAP notes. No audio is stored permanently.',
                        [{ text: 'Continue', onPress: resolve }]
                    );
                });
            }

            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission Denied', 'Microphone access is required to record consultations. Please enable it in your device Settings.');
                return;
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

            // Create recording with metering enabled
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
                (status) => {
                    if (status.metering !== undefined) {
                        setMetering(status.metering);
                    }
                },
                100 // Update every 100ms
            );

            setRecording(recording);
            setIsRecording(true);
            setDuration(0);
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

        // ── USAGE GATE ──────────────────────────────────────────────────────
        // Check plan limits BEFORE any AI call. Fail OPEN on billing errors —
        // a billing system failure must never block a doctor from generating a note.
        try {
            const userId = auth.currentUser?.uid;
            if (userId) {
                const { allowed } = await canGenerateNote(userId);
                if (!allowed) {
                    // Check if we should suppress the modal (dismissed < 1hr ago)
                    const show = await shouldShowUpgradeModal();
                    if (show) setShowUpgradeModal(true);
                    else Alert.alert('Daily Limit', "You've used your 3 free notes for today. Upgrade for unlimited access.");
                    return;
                }
            }
        } catch (gateErr) {
            // Non-fatal: log and proceed — never block patient care
            console.warn('[VitalNote] Usage gate check error (proceeding):', gateErr?.message);
        }
        // ───────────────────────────────────────────────────────────────────

        try {
            // 1. Transcribe
            let currentTranscript = transcript;
            if (audioUri) {
                setStatus('processing_stt');
                // Note: Using AgenticSOAPService which handles transcription internally
                // For now, we'll use the old transcription service
                const { AIService } = require('../services/aiService');
                currentTranscript = await AIService.transcribeAudio(audioUri, selectedLanguage);
                setTranscript(currentTranscript);
            }

            // 2. Generate SOAP using AGENTIC 5-AGENT WORKFLOW
            setStatus('processing_llm');
            if (__DEV__) console.log('🤖 Using Agentic SOAP Generation (5-agent validation)');

            const result = await AgenticSOAPService.generateSOAP(
                auth.currentUser?.uid ?? null,
                currentTranscript,
                selectedLanguage,
                // Text mode is always single-narrator dictation — speaker attribution
                // is meaningless and generates false misattribution concerns.
                inputMode === 'voice' ? isMultiSpeaker : false,
                ({ stage, message }) => {
                    setProgressStage(stage);
                    setProgressMessage(message);
                }
            );

            if (result.success) {
                // [SMART LINKING] Detect meds and add links
                const linkedSoap = SmartLinkService.linkify(result.soapNote);
                setSoapNote(linkedSoap);
                setAgentError(null);
                setQualityMetrics(result.metadata);
                const noteTime  = result.metadata.timeSavedMinutes || 0;
                const noteMoney = result.metadata.moneySavedUSD    || 0;
                setSessionTimeSaved(prev => prev + noteTime);
                setSessionMoneySaved(prev => parseFloat((prev + noteMoney).toFixed(2)));

                // Show quality report
                Alert.alert(
                    '✓ SOAP Note Generated',
                    `Quality Score: ${(result.metadata.qualityScore * 100).toFixed(0)}%\n` +
                    `Revisions: ${result.metadata.revisionCount}\n` +
                    `Hallucinations: ${result.metadata.hallucinationsDetected}\n` +
                    `Generation Time: ${result.metadata.generationTime}s\n` +
                    `Time Saved: ~${noteTime} min  (~$${noteMoney} est.)`,
                    [{ text: 'OK' }]
                );
            } else {
                // Agentic pipeline failed — show error UI with retry button
                console.warn('[VitalNote] Agentic pipeline failed:', result.error);
                setAgentError(_friendlyAgentError(result.error));
                setStatus('error');
                return; // Skip billing increment — no note was generated
            }

            // [BILLING] Increment daily note count after successful generation
            try {
                const userId = auth.currentUser?.uid;
                if (userId) await incrementNoteCount(userId);
            } catch (billingErr) {
                console.warn('[VitalNote] incrementNoteCount error (non-fatal):', billingErr?.message);
            }

            // [METRICS] Update Time Saved
            // Always increment session count
            await SecureStorageService.incrementSessionCount();

            // If duration captured (Voice Mode), add it. 
            // If Text Mode, estimate 5 mins (300s) saved vs manual formatting.
            const timeToAdd = duration > 0 ? duration : 300;
            await SecureStorageService.addDuration(timeToAdd);

            // [SECURITY] Auto-Delete Audio if enabled
            const autoDelete = await SecureStorageService.getItem(STORAGE_KEYS.AUTO_DELETE_AUDIO);
            if (autoDelete === 'true' && audioUri) {
                try {
                    await FileSystem.deleteAsync(audioUri);
                    setAudioUri(null);
                } catch (delErr) {
                    // Auto-delete failed silently — audio remains on device
                }
            }

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
                        // Regular body text - check for bolding OR links
                        // Complex regex to split by **bold** OR [link](url)
                        // Note: A real parser is better, but this works for our specific format

                        // Split by markdown link pattern [text](url) first
                        const parts = line.split(/(\[.*?\]\(.*?\))/g);

                        return (
                            <Text key={index} style={{ fontSize: 16, lineHeight: 24, color: '#333', marginBottom: 4 }}>
                                {parts.map((part, i) => {
                                    // Check for Link
                                    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
                                    if (linkMatch) {
                                        const label = linkMatch[1];
                                        const url = linkMatch[2];
                                        return (
                                            <Text
                                                key={i}
                                                style={{ color: '#2196F3', fontWeight: 'bold', textDecorationLine: 'underline' }}
                                                onPress={() => Linking.openURL(url)}
                                            >
                                                {label}
                                            </Text>
                                        );
                                    }

                                    // Check for Bold (inside non-link parts)
                                    // This is a sub-split
                                    const subParts = part.split(/(\*\*.*?\*\*)/g);
                                    return subParts.map((sub, j) => {
                                        if (sub.startsWith('**') && sub.endsWith('**')) {
                                            return <Text key={`${i}-${j}`} style={{ fontWeight: 'bold' }}>{sub.slice(2, -2)}</Text>;
                                        }
                                        return <Text key={`${i}-${j}`}>{sub}</Text>;
                                    });
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
            {/* Upgrade modal — shown when daily limit is reached */}
            <UpgradeModal
                visible={showUpgradeModal}
                onDismiss={() => setShowUpgradeModal(false)}
            />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>

                    {/* Header Info */}
                    <View style={styles.header}>
                        <Text variant="titleMedium" style={{ color: theme.colors.secondary }}>Patient: {patientName || 'Unknown'}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>Template: {template?.name || 'General'}</Text>
                    </View>

                    {/* Status Feedback */}
                    {status === 'processing_stt' && <ActivityIndicator animating={true} color={theme.colors.primary} size="large" />}
                    {status === 'processing_llm' && (
                        <View style={styles.progressContainer}>
                            <Text style={styles.progressTitle}>Generating your note</Text>
                            {[
                                { stage: 'extracting', label: 'Analysing recording' },
                                { stage: 'writing',    label: 'Writing SOAP note' },
                                { stage: 'auditing',   label: 'Running audit' },
                                { stage: 'rewriting',  label: 'Applying corrections' },
                                { stage: 'complete',   label: 'Finalising note' },
                            ].map((step) => {
                                const stages = ['extracting', 'writing', 'auditing', 'audit_passed', 'rewriting', 'complete'];
                                const currentIndex = stages.indexOf(progressStage);
                                const stepIndex    = stages.indexOf(step.stage);
                                const isDone    = currentIndex > stepIndex;
                                const isCurrent = currentIndex === stepIndex;
                                return (
                                    <View key={step.stage} style={styles.progressRow}>
                                        <Text style={styles.progressIcon}>
                                            {isDone ? '✅' : isCurrent ? '🔄' : '⬜'}
                                        </Text>
                                        <Text style={[
                                            styles.progressLabel,
                                            isDone    && styles.progressLabelDone,
                                            isCurrent && styles.progressLabelActive,
                                        ]}>
                                            {isCurrent ? progressMessage : step.label}
                                        </Text>
                                    </View>
                                );
                            })}
                            <Text style={styles.progressFooter}>Powered by independent AI audit</Text>
                        </View>
                    )}
                    {status === 'error' && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorIcon}>⚠️</Text>
                            <Text style={styles.errorTitle}>Unable to Generate Note</Text>
                            <Text style={styles.errorMessage}>
                                The AI service is currently unreachable.{'\n'}
                                Please check your connection and try again.
                            </Text>
                            <TouchableOpacity
                                style={styles.retryButton}
                                onPress={() => {
                                    setStatus('idle');
                                    setProgressStage('');
                                    setProgressMessage('');
                                    setAgentError(null);
                                }}
                            >
                                <Text style={styles.retryButtonText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Input Area (Hidden when done) */}
                    {status !== 'done' && (
                        <Card style={styles.inputCard}>
                            <Card.Content>
                                {inputMode === 'voice' ? (
                                    <View style={{ alignItems: 'center' }}>
                                        <Text variant="displaySmall" style={{ marginBottom: 16 }}>{formatDuration(duration)}</Text>

                                        {/* Visualizer (Only visible when recording) */}
                                        <View style={{ height: 60, marginBottom: 16, justifyContent: 'center' }}>
                                            {isRecording && <AudioVisualizer isRecording={isRecording} metering={metering} />}
                                            {!isRecording && audioUri && <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Ready to Process</Text>}
                                        </View>

                                        {isRecording ? (
                                            <Button mode="contained" onPress={stopRecording} buttonColor={theme.colors.error}>Stop Recording</Button>
                                        ) : (
                                            <View style={{ width: '100%', alignItems: 'center' }}>
                                                <Button mode="contained" onPress={startRecording} disabled={!!audioUri} style={{ marginBottom: 16, width: '60%' }}>
                                                    {audioUri ? 'Audio Recorded' : 'Start Recording'}
                                                </Button>

                                                {/* Options Row */}
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>

                                                    {/* Language Selector */}
                                                    <Menu
                                                        visible={languageMenuVisible}
                                                        onDismiss={() => setLanguageMenuVisible(false)}
                                                        anchor={
                                                            <Button mode="outlined" onPress={() => setLanguageMenuVisible(true)} icon="translate">
                                                                {LANGUAGES.find(l => l.code === selectedLanguage)?.label || 'English'}
                                                            </Button>
                                                        }
                                                    >
                                                        {LANGUAGES.map((lang) => (
                                                            <Menu.Item
                                                                key={lang.code}
                                                                onPress={() => { setSelectedLanguage(lang.code); setLanguageMenuVisible(false); }}
                                                                title={lang.label}
                                                            />
                                                        ))}
                                                    </Menu>

                                                    {/* Multi-Speaker Toggle */}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceVariant, padding: 8, borderRadius: 20 }}>
                                                        <Text variant="labelMedium" style={{ marginRight: 8 }}>Multi-Speaker</Text>
                                                        <Switch value={isMultiSpeaker} onValueChange={setIsMultiSpeaker} color={theme.colors.secondary} />
                                                    </View>
                                                </View>
                                            </View>
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
                                    <Button mode="text" onPress={() => {
                                        const next = inputMode === 'voice' ? 'text' : 'voice';
                                        setInputMode(next);
                                        // Switching to text mode: discard any pending audio so
                                        // processConsultation doesn't try to transcribe it.
                                        if (next === 'text') {
                                            setAudioUri(null);
                                            setDuration(0);
                                        }
                                    }}>
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
                            {qualityMetrics?.auditFailed === true && (
                                <View style={styles.auditWarningBanner}>
                                    <Text style={styles.auditWarningText}>
                                        ⚠️  Note generated — independent audit unavailable. Please review carefully.
                                    </Text>
                                </View>
                            )}
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

                            {/* Quality Metrics Card (Agentic System) */}
                            {!qualityMetrics && agentError && (
                                <Card style={[styles.card, { backgroundColor: '#FFF8E1' }]} mode="elevated">
                                    <Card.Content style={{ paddingTop: 12, paddingBottom: 12 }}>
                                        <Text variant="labelMedium" style={{ fontWeight: 'bold', color: '#E65100' }}>
                                            ⚠️ Quality Analysis Unavailable
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: '#555', marginTop: 6 }}>
                                            Fell back to standard generation.{'\n'}
                                            Reason: {agentError.slice(0, 200)}
                                        </Text>
                                    </Card.Content>
                                </Card>
                            )}
                            {qualityMetrics && (
                                <Card style={styles.card} mode="elevated">
                                    <Card.Title title="📊 Quality Metrics (5-Agent Validation)" titleStyle={{ fontSize: 16 }} />
                                    <Divider />
                                    <Card.Content style={{ paddingTop: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text variant="bodyMedium">Quality Score:</Text>
                                            <Text variant="bodyMedium" style={{
                                                fontWeight: 'bold',
                                                color: qualityMetrics.qualityScore >= 0.8 ? '#4CAF50' : '#FF9800'
                                            }}>
                                                {(qualityMetrics.qualityScore * 100).toFixed(0)}%
                                            </Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text variant="bodyMedium">Revisions:</Text>
                                            <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                                                {qualityMetrics.revisionCount}
                                            </Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text variant="bodyMedium">Generation Time:</Text>
                                            <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                                                {qualityMetrics.generationTime}s
                                            </Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text variant="bodyMedium">Hallucinations:</Text>
                                            <Text variant="bodyMedium" style={{
                                                fontWeight: 'bold',
                                                color: qualityMetrics.hallucinationsDetected === 0 ? '#4CAF50' : '#F44336'
                                            }}>
                                                {qualityMetrics.hallucinationsDetected}
                                            </Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text variant="bodyMedium">Time Saved:</Text>
                                            <Text variant="bodyMedium" style={{ fontWeight: 'bold', color: '#4CAF50' }}>
                                                ~{qualityMetrics.timeSavedMinutes ?? 0} min
                                            </Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text variant="bodyMedium">Value Saved:</Text>
                                            <Text variant="bodyMedium" style={{ fontWeight: 'bold', color: '#4CAF50' }}>
                                                ~${qualityMetrics.moneySavedUSD ?? 0} (est.)
                                            </Text>
                                        </View>

                                        {sessionTimeSaved > (qualityMetrics.timeSavedMinutes ?? 0) && (
                                            <Text variant="bodySmall" style={{ color: '#888', textAlign: 'right', marginBottom: 8 }}>
                                                Session: ~{sessionTimeSaved} min · ~${sessionMoneySaved} saved
                                            </Text>
                                        )}

                                        {qualityMetrics.validationReport && qualityMetrics.validationReport.concerns && qualityMetrics.validationReport.concerns.length > 0 && (
                                            <View style={{ marginTop: 12, padding: 8, backgroundColor: '#FFF3E0', borderRadius: 4 }}>
                                                <Text variant="labelMedium" style={{ fontWeight: 'bold', marginBottom: 4 }}>⚠️ Validation Concerns:</Text>
                                                {qualityMetrics.validationReport.concerns.map((concern, idx) => (
                                                    <Text key={idx} variant="bodySmall" style={{ marginLeft: 8, marginBottom: 2 }}>
                                                        • {concern.item}: {concern.reason}
                                                    </Text>
                                                ))}
                                            </View>
                                        )}
                                    </Card.Content>
                                </Card>
                            )}

                            {/* Medical Codes Card */}
                            {qualityMetrics && qualityMetrics.medicalCodes && (
                                <Card style={styles.card} mode="elevated">
                                    <Card.Title title="🏥 Medical Codes" titleStyle={{ fontSize: 16 }} />
                                    <Divider />
                                    <Card.Content style={{ paddingTop: 12 }}>
                                        {/* CPT Codes */}
                                        {qualityMetrics.medicalCodes.cpt?.length > 0 && (
                                            <View style={{ marginBottom: 12 }}>
                                                <Text variant="labelMedium" style={{ fontWeight: 'bold', marginBottom: 6 }}>CPT® Codes</Text>
                                                {qualityMetrics.medicalCodes.cpt.map((item, idx) => (
                                                    <View key={idx} style={{ marginBottom: 6, padding: 8, backgroundColor: '#F3F4F6', borderRadius: 6 }}>
                                                        <Text variant="bodySmall" style={{ fontWeight: 'bold' }}>{item.code} — {item.description}</Text>
                                                        <Text variant="bodySmall" style={{ color: '#666', marginTop: 2 }}>{item.justification}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        {/* ICD-10 Codes */}
                                        {qualityMetrics.medicalCodes.icd10?.length > 0 && (
                                            <View style={{ marginBottom: 12 }}>
                                                <Text variant="labelMedium" style={{ fontWeight: 'bold', marginBottom: 6 }}>ICD-10-CM Codes</Text>
                                                {qualityMetrics.medicalCodes.icd10.map((item, idx) => (
                                                    <View key={idx} style={{ marginBottom: 6, padding: 8, backgroundColor: '#F0FDF4', borderRadius: 6 }}>
                                                        <Text variant="bodySmall" style={{ fontWeight: 'bold' }}>{item.code} — {item.description}</Text>
                                                        <Text variant="bodySmall" style={{ color: '#666', marginTop: 2 }}>{item.justification}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        {/* HCPCS Level II */}
                                        {qualityMetrics.medicalCodes.hcpcs?.length > 0 && (
                                            <View>
                                                <Text variant="labelMedium" style={{ fontWeight: 'bold', marginBottom: 6 }}>HCPCS Level II</Text>
                                                {qualityMetrics.medicalCodes.hcpcs.map((item, idx) => (
                                                    <View key={idx} style={{ marginBottom: 6, padding: 8, backgroundColor: '#EFF6FF', borderRadius: 6 }}>
                                                        <Text variant="bodySmall" style={{ fontWeight: 'bold' }}>{item.code} — {item.description}</Text>
                                                        <Text variant="bodySmall" style={{ color: '#666', marginTop: 2 }}>{item.justification}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </Card.Content>
                                </Card>
                            )}

                            <View style={styles.actionButtons}>
                                <Button
                                    mode="contained"
                                    icon="file-pdf-box"
                                    onPress={() => {
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
    actionButtons: { flexDirection: 'row', marginTop: 24, paddingBottom: 20 },
    // Progress tracker
    progressContainer:   { alignItems: 'center', padding: 24, marginVertical: 8 },
    progressTitle:       { fontSize: 17, fontWeight: '700', color: '#1A5490', marginBottom: 20 },
    progressRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, width: '80%' },
    progressIcon:        { fontSize: 18, width: 28, textAlign: 'center' },
    progressLabel:       { fontSize: 15, color: '#6B7280', flex: 1 },
    progressLabelDone:   { color: '#4CAF50' },
    progressLabelActive: { color: '#1A5490', fontWeight: '600' },
    progressFooter:      { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 20 },
    // Error state
    errorContainer:  { alignItems: 'center', padding: 32 },
    errorIcon:       { fontSize: 48, marginBottom: 16 },
    errorTitle:      { fontSize: 20, fontWeight: '700', color: '#0D1B2A', marginBottom: 8 },
    errorMessage:    { fontSize: 15, textAlign: 'center', color: '#6B7280', marginBottom: 24, lineHeight: 22 },
    retryButton:     { backgroundColor: '#1A5490', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
    retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    // Audit warning banner
    auditWarningBanner: { backgroundColor: '#FFF3CD', borderRadius: 8, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#FF9800' },
    auditWarningText:   { fontSize: 14, color: '#7A4F00', lineHeight: 20 },
});
