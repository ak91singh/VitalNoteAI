// UsageBanner.js
// Shown at the top of DashboardScreen for free-tier users only.
// Shows how many of the 3 daily free notes have been used.
// Tapping opens agentryinc.com/subscribe in the device browser.
// Invisible for paid/lifetime users.

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../services/firebase';
import { getPlanStatus } from '../services/PlanManager';

export default function UsageBanner() {
    const theme = useTheme();
    const [status, setStatus] = useState(null);

    // Refresh on every screen focus (e.g. user comes back from ConsultationScreen)
    useFocusEffect(
        useCallback(() => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            getPlanStatus(uid)
                .then(s => setStatus(s))
                .catch(() => {}); // non-fatal — banner simply doesn't show
        }, [])
    );

    // Don't render for paid/lifetime users or while loading
    if (!status) return null;
    if (status.isLifetime || status.plan !== 'free') return null;

    const used = status.notesUsed;
    const remaining = Math.max(0, 3 - used);
    const isNearLimit = remaining <= 1;

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL('https://www.agentryinc.com/subscribe').catch(() => {})}
            style={[
                styles.banner,
                { backgroundColor: isNearLimit ? '#FFF3E0' : '#E3F2FD' },
            ]}
            activeOpacity={0.8}
        >
            <Text style={[
                styles.text,
                { color: isNearLimit ? '#E65100' : '#1565C0' },
            ]}>
                {used === 0
                    ? `3 free notes available today`
                    : remaining === 0
                        ? `Daily limit reached · Upgrade for unlimited`
                        : `${used} of 3 free notes used today`
                }
                {'  '}
                <Text style={[styles.link, { color: theme.colors.primary }]}>
                    Upgrade →
                </Text>
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    banner: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    link: {
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
});
