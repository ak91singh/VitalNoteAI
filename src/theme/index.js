import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1A5490', // Deep Trust Blue
    secondary: '#00A896', // Clean Teal (Accents)
    tertiary: '#007EA7', // Lighter Blue for info
    error: '#BA1A1A',
    background: '#F5F7FA', // Clinical Light Grey
    surface: '#FFFFFF',
    surfaceVariant: '#E1E8ED', // Card backgrounds
    text: '#0D1B2A', // Very Dark Blue (Black replacement)
    outline: '#79747E',
  },
  roundness: 12,
  animation: {
    scale: 1.0,
  },
};
