// Pantalla inicial web — react-native-web sobre el mismo codigo de mobile
import { StyleSheet, Text, View } from 'react-native';
import type { EstadoTicket } from '@helpdesk/shared';

const ESTADOS: EstadoTicket[] = [
  'abierto',
  'en_proceso',
  'solucionado',
  'cerrado',
  'devuelto',
  'programado',
];

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HelpDesk — Web</Text>
      <Text style={styles.subtitle}>react-native-web · mismo codigo que mobile</Text>
      <Text style={styles.body}>Estados: {ESTADOS.join(' · ')}</Text>
      <Text style={styles.muted}>Supabase RLS + search_path OK</Text>
    </View>
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
