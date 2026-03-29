import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Image } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

export default function SignupScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [agreed, setAgreed] = useState(false);

    useEffect(() => {
        try {
            GoogleSignin.configure({
                webClientId: '210524741398-veoha04v58hat92d67brvvevm3od4do1.apps.googleusercontent.com',
            });
        } catch (e) {
            if (__DEV__) console.error("Google Sign-In Config Error:", e);
        }
    }, []);

    const handleSignup = async () => {
        if (!email || !password || !name) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        if (!agreed) {
            Alert.alert('Error', 'You must agree to the Terms of Service and Privacy Policy to continue.');
            return;
        }
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Create user profile
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name,
                email,
                createdAt: new Date().toISOString(),
                role: 'user', // Default role
                subscriptionStatus: 'trial',
                trialCount: 0
            });
        } catch (error) {
            Alert.alert('Signup Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        if (!agreed) {
            Alert.alert('Error', 'You must agree to the Terms of Service and Privacy Policy to continue.');
            return;
        }
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();

            // v16 API: signIn() returns { type, data } not { idToken } directly
            const response = await GoogleSignin.signIn();
            if (response.type !== 'success') {
                // User cancelled — not an error
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
            const userCredential = await signInWithCredential(auth, googleCredential);

            // Check if user document exists, if not create it
            const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    name: userCredential.user.displayName,
                    email: userCredential.user.email,
                    createdAt: new Date().toISOString(),
                    role: 'user',
                    subscriptionStatus: 'trial',
                    trialCount: 0
                });
            }
        } catch (error) {
            if (__DEV__) console.error('Google Sign-Up Error:', error);
            Alert.alert('Google Sign-In Error', error.message || 'An unexpected error occurred.');
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

                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join VitalNote AI today</Text>

                <TextInput
                    label="Full Name"
                    value={name}
                    onChangeText={setName}
                    mode="outlined"
                    style={styles.input}
                />
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

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Button
                        mode="text"
                        compact
                        onPress={() => setAgreed(!agreed)}
                        icon={agreed ? "checkbox-marked" : "checkbox-blank-outline"}
                    >
                        I agree to the
                    </Button>
                    <Text
                        style={{ color: theme.colors.primary, fontWeight: 'bold' }}
                        onPress={() => navigation.navigate('TermsOfService')}
                    >
                        Terms
                    </Text>
                    <Text> & </Text>
                    <Text
                        style={{ color: theme.colors.primary, fontWeight: 'bold' }}
                        onPress={() => navigation.navigate('PrivacyPolicy')}
                    >
                        Privacy Policy
                    </Text>
                </View>

                <Button
                    mode="outlined"
                    icon="google"
                    onPress={handleGoogleSignup}
                    loading={loading}
                    style={[styles.button, { marginBottom: 16, borderColor: '#DB4437' }]}
                    textColor="#DB4437"
                >
                    Sign up with Google
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
                    onPress={handleSignup}
                    loading={loading}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                >
                    Sign Up
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.goBack()}
                    style={styles.linkButton}
                >
                    Already have an account? Login
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
