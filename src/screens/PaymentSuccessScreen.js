import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';
import { getPlanStatus } from '../services/PlanManager';

const PLAN_LABELS = {
    monthly:   'Monthly Plan',
    quarterly: 'Quarterly Plan',
    annual:    'Annual Plan',
    lifetime:  'Lifetime Access',
};

export default function PaymentSuccessScreen({ navigation, route }) {
    const theme = useTheme();
    const { plan, expiry } = route.params || {};

    // Pre-fetch plan status so cache is warm when user returns to Dashboard
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (uid) getPlanStatus(uid).catch(() => {});
    }, []);

    const planLabel = PLAN_LABELS[plan] || plan || 'Premium Plan';
    const expiryLabel = plan === 'lifetime'
        ? 'Never expires'
        : expiry
            ? `Active until ${new Date(expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
            : 'Active';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>

                <Text style={styles.emoji}>✅</Text>
                <Text variant="headlineMedium" style={styles.title}>
                    You're all set!
                </Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                    Unlimited notes activated.
                </Text>

                <Card style={styles.card} mode="elevated">
                    <Card.Content>
                        <View style={styles.row}>
                            <Text variant="bodyMedium" style={styles.label}>Plan</Text>
                            <Text variant="bodyMedium" style={styles.value}>{planLabel}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text variant="bodyMedium" style={styles.label}>Status</Text>
                            <Text variant="bodyMedium" style={[styles.value, { color: '#4CAF50', fontWeight: 'bold' }]}>Active</Text>
                        </View>
                        <View style={styles.row}>
                            <Text variant="bodyMedium" style={styles.label}>Validity</Text>
                            <Text variant="bodyMedium" style={styles.value}>{expiryLabel}</Text>
                        </View>
                        {plan === 'lifetime' && (
                            <View style={styles.row}>
                                <Text variant="bodyMedium" style={styles.label}>Type</Text>
                                <Text variant="bodyMedium" style={[styles.value, { color: '#7B1FA2', fontWeight: 'bold' }]}>♾ Lifetime</Text>
                            </View>
                        )}
                    </Card.Content>
                </Card>

                <Button
                    mode="contained"
                    icon="stethoscope"
                    onPress={() => navigation.replace('Dashboard')}
                    style={styles.ctaBtn}
                    contentStyle={{ height: 56 }}
                    labelStyle={{ fontSize: 16 }}
                    buttonColor={theme.colors.primary}
                >
                    Start Generating Notes
                </Button>

                <Text style={styles.footer}>
                    A receipt has been sent to your registered email.{'\n'}
                    Questions? support@vitalnote.ai
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 72, marginBottom: 16 },
    title: { fontWeight: 'bold', color: '#1565C0', textAlign: 'center', marginBottom: 8 },
    subtitle: { color: '#444', textAlign: 'center', marginBottom: 32 },
    card: { width: '100%', backgroundColor: 'white', marginBottom: 32 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    label: { color: '#666' },
    value: { fontWeight: '500' },
    ctaBtn: { width: '100%', borderRadius: 12, marginBottom: 24 },
    footer: { textAlign: 'center', color: '#999', fontSize: 13, lineHeight: 20 },
});
