// RF-03 — Recuperación elegante
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { theme, Card, Button } from '@helpdesk/shared';
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
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={s.hero}>
        <View style={s.hairline} />
        <Text style={s.eyebrow}>Recuperación segura</Text>
        <Text style={s.title}>Restablece tu acceso</Text>
        <Text style={s.subtitle}>Te enviamos un enlace único a tu correo corporativo. Válido 1 hora · límite 60s entre envíos.</Text>
      </View>
      <View style={s.body}>
        <Card style={s.card}>
          <Text style={s.label}>Correo corporativo</Text>
          <TextInput placeholder="correo@iue.edu.co" placeholderTextColor={theme.colors.mutedSoft} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={s.input} />
          {error ? <View style={s.errorBox}><Text style={s.error}>{error}</Text></View> : null}
          <Button title={loading ? 'Enviando…' : sent ? 'Reenviar enlace' : 'Enviar enlace'} onPress={onSubmit} variant="brass" disabled={loading} />
          {sent ? <Text style={s.hint}>Si no llega, espera 60s y reintenta. Revisa spam y la bandeja de Inbucket si estás en local.</Text> : null}
          <Pressable onPress={() => (navigation as unknown as { goBack?: () => void })?.goBack?.()} style={s.back}>
            <Text style={s.backText}>← Volver al ingreso</Text>
          </Pressable>
        </Card>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 6 },
  hairline: { height: 2, width: 32, backgroundColor: theme.colors.accent, borderRadius: 999 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.accentStrong },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: theme.colors.muted, lineHeight: 18 },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  card: { gap: 12, padding: 18, borderRadius: theme.radius.xl },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: theme.colors.textSoft },
  input: { borderWidth: 1.2, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FFFEFB', fontSize: 14, color: theme.colors.text },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 10 },
  error: { color: '#7F1D1D', fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  back: { alignItems: 'center', paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt },
  backText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
});
