import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, List, Divider, useTheme, Avatar, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../services/firebase'; // Assuming auth is exported from firebase.js

export default function ProfileScreen({ navigation }) {
    const theme = useTheme();
    const user = auth.currentUser;

    const handleLogout = async () => {
        try {
            await auth.signOut();
        } catch (error) {
            Alert.alert("Error", "Failed to log out");
        }
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
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Free Plan</Text>
                    </View>
                </View>

                {/* Subscription Stub */}
                <Card style={styles.card}>
                    <Card.Title title="Subscription Status" left={(props) => <List.Icon {...props} icon="star-circle" color="#FFD700" />} />
                    <Card.Content>
                        <Text variant="bodyMedium">You are currently on the <Text style={{ fontWeight: 'bold' }}>Free Tier</Text>.</Text>
                        <Text variant="bodySmall" style={{ marginTop: 8, color: 'gray' }}>
                            8 / 10 Free Consultations Remaining
                        </Text>
                        <Button mode="contained" style={{ marginTop: 16 }} onPress={() => Alert.alert("Coming Soon", "Premium subscriptions will be available shortly!")}>
                            Upgrade to Pro
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
                        onPress={() => navigation.navigate('PrivacyPolicy')}
                    />
                    <List.Item
                        title="Terms of Service"
                        left={props => <List.Icon {...props} icon="file-document" />}
                        onPress={() => navigation.navigate('TermsOfService')}
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

                <Text style={styles.version}>Version 1.0.0 (Build 2026.1)</Text>

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
