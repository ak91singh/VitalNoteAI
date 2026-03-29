import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keys for our storage
export const STORAGE_KEYS = {
    AUTO_DELETE_AUDIO: 'settings_auto_delete_audio',
    TOTAL_SESSIONS: 'metrics_total_sessions',
    TOTAL_DURATION: 'metrics_total_duration', // in seconds
    USER_TOKEN: 'auth_user_token', // Future use
};

export const SecureStorageService = {
    // Save a value (Strings only, so we stringify JSON)
    async saveItem(key, value) {
        try {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            if (Platform.OS === 'web') {
                // SecureStore doesn't work on web, fallback to localStorage
                localStorage.setItem(key, stringValue);
            } else {
                await SecureStore.setItemAsync(key, stringValue);
            }
        } catch (error) {
            if (__DEV__) console.error(`SecureStorage Error saving ${key}:`, error);
        }
    },

    // Get a value
    async getItem(key, isJson = false) {
        try {
            let result;
            if (Platform.OS === 'web') {
                result = localStorage.getItem(key);
            } else {
                result = await SecureStore.getItemAsync(key);
            }

            if (result && isJson) {
                return JSON.parse(result);
            }
            return result;
        } catch (error) {
            if (__DEV__) console.error(`SecureStorage Error getting ${key}:`, error);
            return null;
        }
    },

    // Delete a value
    async deleteItem(key) {
        try {
            if (Platform.OS === 'web') {
                localStorage.removeItem(key);
            } else {
                await SecureStore.deleteItemAsync(key);
            }
        } catch (error) {
            if (__DEV__) console.error(`SecureStorage Error deleting ${key}:`, error);
        }
    },

    // Specific Helpers for Metrics
    async incrementSessionCount() {
        const current = await this.getItem(STORAGE_KEYS.TOTAL_SESSIONS);
        const count = current ? parseInt(current, 10) : 0;
        await this.saveItem(STORAGE_KEYS.TOTAL_SESSIONS, count + 1);
    },

    async addDuration(seconds) {
        const current = await this.getItem(STORAGE_KEYS.TOTAL_DURATION);
        const total = current ? parseInt(current, 10) : 0;
        await this.saveItem(STORAGE_KEYS.TOTAL_DURATION, total + seconds);
    },

    // Clear all app data (Panic Button)
    async clearAllData() {
        try {
            // Loop through known keys
            const keys = Object.values(STORAGE_KEYS);
            for (const key of keys) {
                await this.deleteItem(key);
            }
        } catch (e) {
            if (__DEV__) console.error("Error clearing data", e);
        }
    }
};
