import React, { useState } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function ForgotPasswordScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleReset = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            Alert.alert('Request Received', 'If an account exists with this email, you will receive a password reset link shortly.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            // Security: Don't reveal if user exists, but handle format errors
            if (error.code === 'auth/invalid-email') {
                Alert.alert('Error', 'Please enter a valid email address.');
            } else {
                // Determine if we should show a generic success to prevent enumeration or just generic error
                // For UX, sticking to generic success is safer, or generic error for network issues.
                Alert.alert('Request Received', 'If an account exists with this email, you will receive a password reset link shortly.', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <Image
                        source={require('../../assets/vitalnote_logo.png')}
                        style={{ width: 80, height: 80 }}
                        resizeMode="contain"
                    />
                </View>

                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>Enter your email to receive a reset link</Text>

                <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                />

                <Button
                    mode="contained"
                    onPress={handleReset}
                    loading={loading}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                >
                    Send Reset Link
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.goBack()}
                    style={styles.linkButton}
                >
                    Back to Login
                </Button>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.primary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.placeholder,
        marginBottom: 32,
    },
    input: {
        marginBottom: 16,
        backgroundColor: theme.colors.surface,
    },
    button: {
        marginTop: 16,
        borderRadius: 8,
    },
    buttonContent: {
        height: 48,
    },
    linkButton: {
        marginTop: 16,
    },
});
