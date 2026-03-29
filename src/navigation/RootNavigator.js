import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebase';
import { theme } from '../theme';

import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ConsultationScreen from '../screens/ConsultationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NewConsultationScreen from '../screens/NewConsultationScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import DisclaimerScreen from '../screens/legal/DisclaimerScreen';
import PricingScreen from '../screens/PricingScreen';

const Stack = createNativeStackNavigator();

const DISCLAIMER_KEY = 'vitalnote_disclaimer_accepted';

// ── First-Launch Medical Disclaimer Modal ──────────────────────────────────
function DisclaimerModal({ visible, onAccept }) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={() => { /* force user to accept */ }}
        >
            <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Medical Disclaimer</Text>
                <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 16 }}>
                    <Text style={styles.modalBody}>
                        VitalNote AI is designed to assist healthcare professionals with documentation only.
                        {'\n\n'}
                        It is NOT a substitute for professional medical judgment, diagnosis, or treatment.
                        Always rely on your clinical training and judgment when making patient care decisions.
                        {'\n\n'}
                        AI-generated SOAP notes may contain errors or omissions. You are solely responsible
                        for reviewing, correcting, and using any content produced by this app.
                        {'\n\n'}
                        Do not use this app in emergency situations. If a patient is in immediate danger,
                        call emergency services immediately.
                        {'\n\n'}
                        By tapping "I Understand & Agree" you confirm that you are a licensed healthcare
                        professional and agree to use this tool responsibly.
                    </Text>
                </ScrollView>
                <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
                    <Text style={styles.acceptButtonText}>I Understand & Agree</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

// ── Root Navigator ─────────────────────────────────────────────────────────
export default function RootNavigator() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    useEffect(() => {
        // Check auth state AND disclaimer acceptance in parallel
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });

        AsyncStorage.getItem(DISCLAIMER_KEY).then((val) => {
            if (val !== 'true') {
                setShowDisclaimer(true);
            }
        });

        return unsubscribe;
    }, []);

    const handleDisclaimerAccept = async () => {
        await AsyncStorage.setItem(DISCLAIMER_KEY, 'true');
        setShowDisclaimer(false);
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <>
            <DisclaimerModal visible={showDisclaimer} onAccept={handleDisclaimerAccept} />

            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {user ? (
                        // Authenticated Stack
                        <Stack.Group>
                            <Stack.Screen name="Dashboard" component={DashboardScreen} />
                            <Stack.Screen name="NewConsultation" component={NewConsultationScreen} />
                            <Stack.Screen name="Consultation" component={ConsultationScreen} />
                            <Stack.Screen name="Profile" component={ProfileScreen} />
                            <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: true, title: 'Legal' }} />
                            {/* Subscribe screen — opens website for plan management */}
                            <Stack.Screen name="Pricing" component={PricingScreen} options={{ headerShown: true, title: 'Subscribe' }} />
                        </Stack.Group>
                    ) : (
                        // Auth Stack
                        <Stack.Group>
                            <Stack.Screen name="Welcome" component={WelcomeScreen} />
                            <Stack.Screen name="Login" component={LoginScreen} />
                            <Stack.Screen name="Signup" component={SignupScreen} />
                            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                        </Stack.Group>
                    )}
                    <Stack.Group screenOptions={{ presentation: 'modal', headerShown: true }}>
                        <Stack.Screen name="Disclaimer" component={DisclaimerScreen} options={{ title: 'Medical Disclaimer' }} />
                    </Stack.Group>
                </Stack.Navigator>
            </NavigationContainer>
        </>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 24,
        paddingTop: 60,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#c0392b',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalScroll: {
        flex: 1,
        marginBottom: 16,
    },
    modalBody: {
        fontSize: 15,
        color: '#333',
        lineHeight: 24,
    },
    acceptButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
