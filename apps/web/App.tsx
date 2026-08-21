// Pantalla inicial web — RF-04 + RF-05 (mismo codigo que mobile)
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ROLES } from '@helpdesk/shared';
import { AuthProvider, useAuth } from './src/context/AuthContext';

function AppInner() {
  const { profile, loading, error } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HelpDesk — Web</Text>
      <Text style={styles.subtitle}>react-native-web · mismo codigo que mobile</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
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
          <Text style={styles.muted}>{error ? `Error: ${error}` : 'Sin sesión'}</Text>
        </>
      )}
      <Text style={styles.muted}>Supabase 5 migraciones · RLS RF-05 OK</Text>
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
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: '#334155',
    fontSize: 13,
    marginTop: 8,
  },
  body: {
    color: '#475569',
    fontSize: 11,
    marginTop: 16,
  },
  muted: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 8,
  },
});
