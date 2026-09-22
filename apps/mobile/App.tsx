// Entry — AuthProvider + navegacion por rol (RF-05)
import { ThemeProvider } from '@helpdesk/shared';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';

const themeStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider storage={themeStorage}>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}


