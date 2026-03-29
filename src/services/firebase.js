import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyBOUsszyeJtXeo6eW6zIJKdiqD4FPybQkw",
    authDomain: "vitalnoteai-prod.firebaseapp.com",
    projectId: "vitalnoteai-prod",
    storageBucket: "vitalnoteai-prod.firebasestorage.app",
    messagingSenderId: "210524741398",
    appId: "1:210524741398:web:4dde5074f0defbb7237a37"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// BUG 3 FIX: typeof window is ALWAYS true in React Native (RN polyfills window).
// Use a clean singleton pattern: initializeAuth with persistence, catch double-init on hot reload.
let auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
} catch (e) {
    // Already initialized (e.g. fast refresh / hot reload) — get the existing instance
    auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
