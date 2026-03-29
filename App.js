import 'react-native-gesture-handler'; // MUST BE AT THE VERY TOP
import React, { useEffect } from 'react';
import { LogBox, View, Text, StyleSheet } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { theme } from './src/theme';
import RootNavigator from './src/navigation/RootNavigator';
import CrashReportingService from './src/services/CrashReportingService';

// Prevent auto hide if possible, but don't crash if it fails
try {
  SplashScreen.preventAutoHideAsync().catch(() => { });
} catch (e) { }

// Ignore specific warnings that are safe
LogBox.ignoreLogs(['Expo AV has been deprecated']);

// B7 — Install global JS error handler as early as possible (before any component mounts)
CrashReportingService.initialize();

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Dev: log to Metro console
    if (__DEV__) {
      console.error("Uncaught Error:", error, errorInfo);
    }
    // Production: send to Firestore crash_logs collection (B7)
    CrashReportingService.reportBoundaryError(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Oops! Something went wrong.</Text>
          <Text style={styles.errorText}>
            Please restart the app. If the issue continues, contact support.
          </Text>
          <Text style={styles.retryButton} onPress={this.handleRetry}>
            Tap here to try again
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  useEffect(() => {
    // Safety Force Hide: Ensure splash screen hides after 1 second
    const timer = setTimeout(async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        if (__DEV__) console.warn("Splash Hide Error:", e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <PaperProvider theme={theme}>
            <RootNavigator />
          </PaperProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#c0392b',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    fontSize: 16,
    color: '#2980b9',
    textDecorationLine: 'underline',
    paddingVertical: 8,
  },
});
