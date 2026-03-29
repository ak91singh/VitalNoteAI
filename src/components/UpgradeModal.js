// UpgradeModal.js
// Shown when a free user hits the 3-note daily limit.
// Dismissible — stores dismissal time in AsyncStorage and suppresses for 1 hour.
// "Subscribe" opens agentryinc.com/subscribe in the device browser.

import React, { useCallback } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISS_KEY = 'vitalnote_upgrade_modal_dismissed_at';
const SUPPRESS_MS = 60 * 60 * 1000; // 1 hour

// Call this before showing the modal to respect the suppression window
export async function shouldShowUpgradeModal() {
    try {
        const val = await AsyncStorage.getItem(DISMISS_KEY);
        if (!val) return true;
        const elapsed = Date.now() - parseInt(val, 10);
        return elapsed > SUPPRESS_MS;
    } catch {
        return true;
    }
}

export default function UpgradeModal({ visible, onDismiss }) {
    const theme = useTheme();

    const handleDismiss = useCallback(async () => {
        try {
            await AsyncStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            // non-fatal
        }
        onDismiss?.();
    }, [onDismiss]);

    const handleSubscribe = useCallback(() => {
        Linking.openURL('https://www.agentryinc.com/subscribe').catch(() => {});
        onDismiss?.();
    }, [onDismiss]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleDismiss}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={handleDismiss}
            >
                {/* Prevent touch events on the card from closing the modal */}
                <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                    <View style={styles.card}>

                        <Text style={styles.emoji}>🚀</Text>
                        <Text variant="titleLarge" style={styles.title}>
                            Daily limit reached
                        </Text>
                        <Text variant="bodyMedium" style={styles.body}>
                            You've used your 3 free notes for today.{'\n'}
                            Upgrade to Pro for unlimited notes at agentryinc.com.
                        </Text>

                        <Button
                            mode="contained"
                            onPress={handleSubscribe}
                            style={{ marginTop: 8, borderRadius: 10 }}
                            contentStyle={{ height: 52 }}
                            buttonColor={theme.colors.primary}
                        >
                            Subscribe at agentryinc.com →
                        </Button>

                        <Button
                            mode="text"
                            onPress={handleDismiss}
                            style={{ marginTop: 4 }}
                            textColor="#888"
                        >
                            Maybe later
                        </Button>

                        <Text style={styles.reset}>
                            Free notes reset at midnight
                        </Text>

                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 36,
        alignItems: 'center',
    },
    emoji: { fontSize: 48, marginBottom: 8 },
    title: { fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    body: { color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
    reset: { color: '#aaa', fontSize: 12, marginTop: 12 },
});
