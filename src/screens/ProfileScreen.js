import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Linking } from 'react-native';
import { Text, Avatar, Button, Card, Divider, List, Switch, useTheme, IconButton, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import * as Application from 'expo-application';
import { auth } from '../services/firebase';
import { SecureStorageService, STORAGE_KEYS } from '../services/SecureStorageService';
import { getPlanStatus } from '../services/PlanManager';

const PLAN_LABELS = { free: 'Free', monthly: 'Monthly Pro', quarterly: 'Quarterly Pro', annual: 'Annual Pro', lifetime: 'Lifetime Pro' };
const PLAN_COLORS = { free: '#888', monthly: '#1565C0', quarterly: '#0277BD', annual: '#01579B', lifetime: '#6A1B9A' };

export default function ProfileScreen({ navigation }) {
    const theme = useTheme();
    const user = auth.currentUser;

    const [autoDelete, setAutoDelete] = useState(false);
    const [planStatus, setPlanStatus] = useState(null);
    const [planLoading, setPlanLoading] = useState(true);

    useEffect(() => {
        loadSettings();
        loadPlanStatus();
    }, []);

    const loadSettings = async () => {
        const val = await SecureStorageService.getItem(STORAGE_KEYS.AUTO_DELETE_AUDIO);
        setAutoDelete(val === 'true');
    };

    const loadPlanStatus = async () => {
        try {
            const uid = auth.currentUser?.uid;
            if (uid) {
                const status = await getPlanStatus(uid);
                setPlanStatus(status);
            }
        } catch {
            // non-fatal — stub UI shown as fallback
        } finally {
            setPlanLoading(false);
        }
    };

    const toggleAutoDelete = async (value) => {
        setAutoDelete(value);
        await SecureStorageService.saveItem(STORAGE_KEYS.AUTO_DELETE_AUDIO, value);
    };

    const handleLogout = () => {
        Alert.alert(
            "Log Out",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Log Out", onPress: () => {
                        signOut(auth).then(() => {
                            navigation.replace('Login');
                        }).catch(error => Alert.alert("Error", error.message));
                    }
                }
            ]
        );
    };

    const handleClearData = () => {
        Alert.alert(
            "Clear Local Data",
            "This will reset your preferences and local metrics. It will NOT delete your account. Proceed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: 'destructive',
                    onPress: async () => {
                        await SecureStorageService.clearAllData();
                        setAutoDelete(false);
                        Alert.alert("Success", "Local data cleared.");
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Header / Profile Card */}
                <View style={styles.header}>
                    <Avatar.Text
                        size={80}
                        label={user?.email ? user.email.substring(0, 2).toUpperCase() : "MD"}
                        style={{ backgroundColor: theme.colors.primary }}
                    />
                    <Text variant="headlineSmall" style={{ marginTop: 16, fontWeight: 'bold' }}>
                        {user?.displayName || "Dr. User"}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: 'gray' }}>
                        {user?.email || "doctor@example.com"}
                    </Text>
                    <View style={[styles.badge, planStatus && { backgroundColor: PLAN_COLORS[planStatus.plan] || '#888' }]}>
                        <Text style={[styles.badgeText, { color: 'white' }]}>
                            {planLoading ? '…' : PLAN_LABELS[planStatus?.plan || 'free']}
                        </Text>
                    </View>
                </View>

                {/* Subscription Status — live data from Firestore */}
                <Card style={styles.card}>
                    <Card.Title
                        title="Subscription Status"
                        left={(props) => <List.Icon {...props} icon="star-circle" color="#FFD700" />}
                    />
                    <Card.Content>
                        {planLoading ? (
                            <ActivityIndicator animating size="small" style={{ marginVertical: 12 }} />
                        ) : planStatus ? (
                            <>
                                <Text variant="bodyMedium">
                                    Plan: <Text style={{ fontWeight: 'bold', color: PLAN_COLORS[planStatus.plan] }}>
                                        {PLAN_LABELS[planStatus.plan] || planStatus.plan}
                                    </Text>
                                </Text>

                                {planStatus.plan === 'free' && (
                                    <Text variant="bodySmall" style={{ marginTop: 6, color: 'gray' }}>
                                        {planStatus.notesUsed} of 3 free notes used today
                                        {' · '}
                                        {Math.max(0, 3 - planStatus.notesUsed)} remaining
                                    </Text>
                                )}

                                {planStatus.isLifetime && (
                                    <Text variant="bodySmall" style={{ marginTop: 6, color: '#6A1B9A', fontWeight: '600' }}>
                                        ♾ Lifetime access — unlimited notes forever
                                    </Text>
                                )}

                                {planStatus.expiry && !planStatus.isLifetime && (
                                    <Text variant="bodySmall" style={{ marginTop: 6, color: 'gray' }}>
                                        Active until {planStatus.expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {planStatus.daysUntilExpiry !== null && ` (${planStatus.daysUntilExpiry}d remaining)`}
                                    </Text>
                                )}

                                {planStatus.plan === 'free' && (
                                    <Button
                                        mode="contained"
                                        style={{ marginTop: 16 }}
                                        onPress={() => navigation.navigate('Pricing')}
                                    >
                                        Upgrade to Pro
                                    </Button>
                                )}

                                {planStatus.plan !== 'free' && !planStatus.isLifetime && (
                                    <Text variant="bodySmall" style={{ marginTop: 12, color: '#888' }}>
                                        To cancel, manage via {planStatus.gateway === 'razorpay' ? 'Razorpay' : 'Stripe'} dashboard or email support@vitalnote.ai
                                    </Text>
                                )}
                            </>
                        ) : (
                            <>
                                <Text variant="bodyMedium">You are on the <Text style={{ fontWeight: 'bold' }}>Free Plan</Text>.</Text>
                                <Button mode="contained" style={{ marginTop: 16 }} onPress={() => navigation.navigate('Pricing')}>
                                    Upgrade to Pro
                                </Button>
                            </>
                        )}
                    </Card.Content>
                </Card>

                <Divider style={{ marginVertical: 16 }} />

                {/* Security & Privacy (NEW) */}
                <Text variant="titleMedium" style={{ marginBottom: 12, marginLeft: 4, color: theme.colors.primary, fontWeight: 'bold' }}>Security & Privacy</Text>
                <Card style={[styles.card, { borderColor: theme.colors.primary, borderWidth: 1 }]} mode="outlined">
                    <Card.Content>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <IconButton icon="shield-check" iconColor={theme.colors.primary} size={24} />
                            <View style={{ flex: 1 }}>
                                <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>HIPAA Compliance Mode</Text>
                                <Text variant="bodySmall" style={{ color: '#666' }}>
                                    VitalNote minimizes data retention on this device.
                                </Text>
                            </View>
                        </View>
                        <Divider style={{ marginBottom: 12 }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                                <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>Auto-Delete Audio</Text>
                                <Text variant="bodySmall" style={{ color: '#888' }}>Remove recording after analysis</Text>
                            </View>
                            <Switch value={autoDelete} onValueChange={toggleAutoDelete} color={theme.colors.primary} />
                        </View>

                        <Button
                            mode="outlined"
                            textColor={theme.colors.error}
                            style={{ marginTop: 16, borderColor: theme.colors.error }}
                            onPress={handleClearData}
                        >
                            Clear Local Data
                        </Button>
                    </Card.Content>
                </Card>

                {/* Account Actions */}
                <List.Section title="Account">
                    <List.Item
                        title="Edit Profile"
                        left={props => <List.Icon {...props} icon="account-edit" />}
                        onPress={() => Alert.alert("Info", "Profile editing coming soon.")}
                    />
                    <List.Item
                        title="Notifications"
                        left={props => <List.Icon {...props} icon="bell" />}
                        onPress={() => { }}
                    />
                </List.Section>

                <Divider />

                {/* Legal & Support */}
                <List.Section title="Legal & Support">
                    <List.Item
                        title="Privacy Policy"
                        left={props => <List.Icon {...props} icon="shield-account" />}
                        onPress={() => Linking.openURL('https://www.agentryinc.com/privacy-policy').catch(() => {})}
                    />
                    <List.Item
                        title="Terms of Service"
                        left={props => <List.Icon {...props} icon="file-document" />}
                        onPress={() => Linking.openURL('https://www.agentryinc.com/terms').catch(() => {})}
                    />
                    <List.Item
                        title="Medical Disclaimer"
                        left={props => <List.Icon {...props} icon="alert-decagram" />}
                        onPress={() => navigation.navigate('Disclaimer')}
                    />
                    <List.Item
                        title="Help & Support"
                        left={props => <List.Icon {...props} icon="help-circle" />}
                        onPress={() => Alert.alert("Support", "Contact: support@vitalnote.ai")}
                    />
                </List.Section>

                <View style={styles.logoutContainer}>
                    <Button
                        mode="outlined"
                        onPress={handleLogout}
                        textColor={theme.colors.error}
                        style={{ borderColor: theme.colors.error }}
                        icon="logout"
                    >
                        Log Out
                    </Button>
                </View>

                <Text style={styles.version}>
                    Version {Application.nativeApplicationVersion || '1.0.0'} (Build {Application.nativeBuildVersion || '1'})
                </Text>

            </ScrollView>
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
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    badge: {
        backgroundColor: '#E0E0E0',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333',
    },
    card: {
        backgroundColor: 'white',
        marginBottom: 16,
    },
    logoutContainer: {
        marginTop: 24,
        marginBottom: 24,
    },
    version: {
        textAlign: 'center',
        color: '#999',
        fontSize: 12,
        marginBottom: 20,
    }
});
