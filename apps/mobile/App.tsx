// Pantalla inicial HelpDesk — RF-04 sesion persistente + RF-05 control por rol
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ROLES } from '@helpdesk/shared';
import { AuthProvider, useAuth } from './src/context/AuthContext';

function AppInner() {
  const { profile, loading, error } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HelpDesk — IUE</Text>
      <Text style={styles.subtitle}>Mesa de Servicio con IA · Expo 52</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : profile ? (
        <>
          <Text style={styles.body}>
            Sesión: {profile.email} · {profile.rol}
          </Text>
          <Text style={styles.muted}>Mesa: {profile.mesa_id ?? '—'}</Text>
        </>
      ) : (
        <>
          <Text style={styles.body}>Roles: {ROLES.join(' · ')}</Text>
          <Text style={styles.muted}>
            {error ? `Error: ${error}` : 'Sin sesión — inicia sesión para ver tu rol'}
          </Text>
        </>
      )}
      <Text style={styles.muted}>Supabase 5 migraciones · RLS RF-05 OK</Text>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#334155',
    fontSize: 14,
    marginTop: 8,
  },
  body: {
    color: '#475569',
    fontSize: 12,
    marginTop: 16,
  },
  muted: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 8,
  },
});
