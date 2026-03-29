import React from 'react';
import { LogBox } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './src/theme';
import RootNavigator from './src/navigation/RootNavigator';

// Ignore specific warnings that are safe
LogBox.ignoreLogs(['Expo AV has been deprecated']);

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <RootNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
