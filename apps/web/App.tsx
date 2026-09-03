// Entry web — mismo stack que mobile via react-native-web
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { supabaseConfigError } from './src/lib/supabase';

export default function App() {
  if (supabaseConfigError) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Configuración faltante</Text>
          <Text style={{ color: '#b00020', marginBottom: 16 }}>{supabaseConfigError}</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>
            Revisa que EXPO_PUBLIC_SUPABASE_URL y ANON_KEY estén en .env y rebuild: docker compose up --build --force-recreate
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}


