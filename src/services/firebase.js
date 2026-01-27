import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBiwPVOUNG9j5TLV4YJrNmzu_mj1Kwqf7E",
    authDomain: "vitalnoteai-19c6d.firebaseapp.com",
    projectId: "vitalnoteai-19c6d",
    storageBucket: "vitalnoteai-19c6d.firebasestorage.app",
    messagingSenderId: "505240327456",
    appId: "1:505240327456:web:008a37e9dbd6a30803f345"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with Persistence
let auth;
if (typeof window !== 'undefined') { // Safety check for simple JS environments
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
} else {
    auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
