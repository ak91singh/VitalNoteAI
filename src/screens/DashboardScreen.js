import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Avatar, useTheme, IconButton, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { SecureStorageService, STORAGE_KEYS } from '../services/SecureStorageService';
import UsageBanner from '../components/UsageBanner';

export default function DashboardScreen({ navigation }) {
    const theme = useTheme();
    const user = auth.currentUser;

    const [greeting, setGreeting] = useState('Good Morning');
    const [stats, setStats] = useState({ savedMinutes: 0, sessions: 0 });
    const [loading, setLoading] = useState(true); // L7: show skeleton while metrics load

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadMetrics();
        }, [])
    );

    const loadMetrics = async () => {
        try {
            const count = await SecureStorageService.getItem(STORAGE_KEYS.TOTAL_SESSIONS);
            const duration = await SecureStorageService.getItem(STORAGE_KEYS.TOTAL_DURATION); // seconds

            const totalSeconds = duration ? parseInt(duration, 10) : 0;
            // Formula: Speaking is ~4x faster than typing & formatting detailed SOAP notes.
            const savedMins = Math.round((totalSeconds * 4) / 60);

            setStats({
                sessions: count ? parseInt(count, 10) : 0,
                savedMinutes: savedMins
            });
        } finally {
            setLoading(false); // L7: hide loader whether load succeeded or failed
        }
    };

    const handleLogout = () => {
        signOut(auth);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                            {greeting}, {user?.displayName ? `Dr. ${user.displayName}` : 'Doctor'}
                        </Text>
                        <Text variant="bodyLarge" style={{ color: '#666' }}>
                            Ready to document your next case?
                        </Text>
                    </View>

                    <IconButton
                        icon="account-circle"
                        size={40}
                        iconColor={theme.colors.primary}
                        onPress={() => navigation.navigate('Profile')}
                        style={{ margin: 0 }}
                    />
                </View>
            </View>

            {/* Usage banner — shown for free users only, invisible for paid/lifetime */}
            <UsageBanner navigation={navigation} />

            {/* ROI WIDGETS — L7: show spinner while metrics load from storage */}
            {loading ? (
                <View style={{ flexDirection: 'row', marginBottom: 24, height: 80, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator animating size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <View style={{ flexDirection: 'row', marginBottom: 24 }}>
                    <Surface style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant, marginRight: 12 }]} elevation={2}>
                        <IconButton icon="clock-check-outline" iconColor={theme.colors.tertiary || '#2196F3'} size={30} />
                        <View>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.tertiary || '#1565C0' }}>{stats.savedMinutes}m</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Time Saved</Text>
                        </View>
                    </Surface>
                    <Surface style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={2}>
                        <IconButton icon="file-document-multiple-outline" iconColor={theme.colors.secondary} size={30} />
                        <View>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.secondary }}>{stats.sessions}</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Analyses</Text>
                        </View>
                    </Surface>
                </View>
            )}

            <View style={styles.actionContainer}>
                <Button
                    mode="contained"
                    icon="plus"
                    contentStyle={{ height: 60 }}
                    labelStyle={{ fontSize: 18 }}
                    onPress={() => navigation.navigate('NewConsultation')}
                    style={styles.mainButton}
                >
                    New Consultation
                </Button>
            </View>

            <Button mode="outlined" onPress={handleLogout} style={styles.logoutButton}>
                Logout
            </Button>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        // backgroundColor: '#F5F7FA', // Replaced by theme content via style injection
    },
    header: {
        marginBottom: 20,
    },
    actionContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    mainButton: {
        borderRadius: 12,
        elevation: 4,
    },
    logoutButton: {
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
    }
});
