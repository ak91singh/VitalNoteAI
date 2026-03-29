import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // BUG 1 FIX: configure must be inside the component, not at module scope
    useEffect(() => {
        try {
            GoogleSignin.configure({
                webClientId: '210524741398-veoha04v58hat92d67brvvevm3od4do1.apps.googleusercontent.com',
            });
        } catch (e) {
            if (__DEV__) console.error("Google Sign-In Config Error:", e);
        }
    }, []);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();

            // BUG 2 FIX: v13+ API returns { type, data } not { idToken } directly
            const response = await GoogleSignin.signIn();

            if (response.type !== 'success') {
                // User cancelled or other non-error non-success state
                setLoading(false);
                return;
            }

            const idToken = response.data?.idToken;
            if (!idToken) {
                Alert.alert('Google Sign-In Error', 'Could not retrieve ID token. Please try again.');
                setLoading(false);
                return;
            }

            const googleCredential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, googleCredential);
        } catch (error) {
            if (__DEV__) console.error('Google Sign-In Error:', error);
            Alert.alert('Google Sign-In Error', error.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            let message = "An error occurred. Please try again.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = "Invalid email or password. Please try again.";
            } else if (error.code === 'auth/invalid-email') {
                message = "The email address is badly formatted.";
            } else if (error.code === 'auth/too-many-requests') {
                message = "Too many failed attempts. Please try again later.";
            }
            Alert.alert('Login Failed', message);
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

                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Sign in to continue</Text>

                <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                />
                <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                />

                <View style={{ alignItems: 'flex-end', marginBottom: 16 }}>
                    <Button
                        mode="text"
                        onPress={() => navigation.navigate('ForgotPassword')}
                        compact
                    >
                        Forgot Password?
                    </Button>
                </View>

                <Button
                    mode="outlined"
                    icon="google"
                    onPress={handleGoogleLogin}
                    loading={loading}
                    style={[styles.button, { marginBottom: 16, borderColor: '#DB4437' }]}
                    textColor="#DB4437"
                >
                    Sign in with Google
                </Button>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#ccc' }} />
                    <View>
                        <Text style={{ width: 50, textAlign: 'center', color: '#999' }}>OR</Text>
                    </View>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#ccc' }} />
                </View>

                <Button
                    mode="contained"
                    onPress={handleLogin}
                    loading={loading}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                >
                    Login
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.navigate('Signup')}
                    style={styles.linkButton}
                >
                    Don't have an account? Sign up
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
