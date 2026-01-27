import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0066CC', // Medical Blue
    secondary: '#00A86B', // Trust Green
    error: '#B00020',
    background: '#F5F7FA',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    placeholder: '#8C8C8C',
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
  roundness: 12,
  animation: {
    scale: 1.0,
  },
};
