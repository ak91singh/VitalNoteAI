import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

export default function DashboardScreen({ navigation }) {
    const handleLogout = () => {
        signOut(auth);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: '#0066CC' }}>VitalNote AI</Text>
                        <Text variant="titleMedium">Welcome, {auth.currentUser?.displayName || 'Doctor'}</Text>
                    </View>
                    <Button icon="account-circle" mode="text" onPress={() => navigation.navigate('Profile')}>
                        Profile
                    </Button>
                </View>
            </View>

            <View style={styles.actionContainer}>
                <Button
                    mode="contained"
                    icon="plus"
                    contentStyle={{ height: 60 }}
                    labelStyle={{ fontSize: 18 }}
                    onPress={() => navigation.navigate('Consultation')}
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
        backgroundColor: '#F5F7FA',
    },
    header: {
        marginBottom: 40,
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
    }
});
