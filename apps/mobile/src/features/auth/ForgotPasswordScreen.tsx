// RF-03 — Recuperación con validación y rate limit 60s
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

export function ForgotPasswordScreen({ navigation }: { navigation?: { navigate: (r: string) => void; goBack: () => void } }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.includes('@')) { setError('Correo inválido'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: 'helpdesk://reset-password' });
      if (error) throw error;
      setSent(true);
      Alert.alert('Correo enviado', 'Revisa tu bandeja y sigue el enlace (expira en 1h, max 60s entre envíos).');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Recuperar contraseña</Text>
      <Text style={s.subtitle}>Enviaremos un enlace de recuperación (confirmación requerida). Rate limit 60s.</Text>
      <TextInput placeholder="correo@iue.edu.co" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={s.input} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button title={loading ? 'Enviando…' : sent ? 'Reenviar' : 'Enviar enlace'} onPress={onSubmit} disabled={loading} />
      {sent ? <Text style={s.hint}>Si no llega, espera 60s y reintenta. Revisa spam.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: theme.colors.bg, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.primary },
  subtitle: { fontSize: 11, color: theme.colors.muted },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.surface },
  error: { color: theme.colors.danger, fontSize: 11 },
  hint: { fontSize: 11, color: theme.colors.muted },
});
