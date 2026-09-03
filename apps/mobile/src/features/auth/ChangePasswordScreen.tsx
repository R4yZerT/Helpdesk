// RF-03 robusto — Cambio elegante con fortaleza
import { useState, useMemo } from 'react';
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme, validatePasswordSync, validatePassword, Card, Button } from '@helpdesk/shared';
import { PasswordStrength } from '../../components/PasswordStrength';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function ChangePasswordScreen({ navigation }: { navigation?: { goBack: () => void } }) {
  const { profile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const sync = useMemo(() => (next ? validatePasswordSync(next, { email: profile?.email ?? undefined, nombre: profile?.full_name ?? undefined, rol: profile?.rol }) : null), [next, profile]);

  const onSubmit = async () => {
    setServerError(null);
    if (!next || !confirm) { setServerError('Completa los campos'); return; }
    if (next !== confirm) { setServerError('Las contraseñas no coinciden'); return; }

    const ctx = { email: profile?.email ?? undefined, nombre: profile?.full_name ?? undefined, rol: profile?.rol };
    const syncCheck = validatePasswordSync(next, ctx);
    if (!syncCheck.ok) { setServerError(syncCheck.reasons[0]); return; }

    setLoading(true);
    try {
      const full = await validatePassword(next, ctx);
      if (!full.ok) { setServerError(full.reasons[0]); return; }

      if (profile?.email && current) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: profile.email, password: current });
        if (reauthErr) { setServerError('Contraseña actual incorrecta'); return; }
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      Alert.alert('Contraseña actualizada', 'Se cerrarán otras sesiones por seguridad (12h/30m).', [{ text: 'OK', onPress: () => navigation?.goBack?.() }]);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={s.hero}>
        <View style={s.hairline} />
        <Text style={s.eyebrow}>Seguridad · NIST 800-63B</Text>
        <Text style={s.title}>Cambiar contraseña</Text>
        <Text style={s.subtitle}>8–64 caracteres · sin composición forzada · verificada contra filtraciones (HIBP fail-closed)</Text>
      </View>
      <View style={s.body}>
        <Card style={s.card}>
          <Text style={s.label}>Contraseña actual</Text>
          <TextInput placeholder="••••••••" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry value={current} onChangeText={setCurrent} style={s.input} />
          <Text style={s.label}>Nueva contraseña</Text>
          <TextInput placeholder="Mín. 8 caracteres" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry value={next} onChangeText={setNext} style={s.input} />
          <PasswordStrength validation={sync} />
          <TextInput placeholder="Confirmar nueva" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry value={confirm} onChangeText={setConfirm} style={[s.input, next && confirm && next !== confirm ? s.inputError : null]} />
          {next && confirm && next !== confirm ? <Text style={s.error}>No coinciden</Text> : null}
          {serverError ? <View style={s.errorBox}><Text style={s.error}>{serverError}</Text></View> : null}
          {loading ? <ActivityIndicator /> : <Button title="Actualizar contraseña" onPress={onSubmit} variant="brass" disabled={loading || !next || !confirm} />}
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
  card: { gap: 10, padding: 18, borderRadius: theme.radius.xl },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: theme.colors.textSoft },
  input: { borderWidth: 1.2, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FFFEFB', fontSize: 14, color: theme.colors.text },
  inputError: { borderColor: '#FCA5A5' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 10 },
  error: { color: '#7F1D1D', fontSize: 12, fontWeight: '600' },
});
