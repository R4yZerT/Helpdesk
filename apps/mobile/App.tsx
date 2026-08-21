// Pantalla inicial HelpDesk — verifica que Expo + shared compilan
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import type { RolUsuario } from '@helpdesk/shared';

// Roles del sistema (RF-05)
const ROLES: RolUsuario[] = ['empleado', 'tecnico', 'jefe', 'administrador'];

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HelpDesk — IUE</Text>
      <Text style={styles.subtitle}>Mesa de Servicio con IA · Expo 52</Text>
      <Text style={styles.body}>Roles: {ROLES.join(' · ')}</Text>
      <Text style={styles.muted}>Supabase stzcqexdivuzmfizvbwp · 4 migraciones OK</Text>
      <StatusBar style="auto" />
    </View>
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
