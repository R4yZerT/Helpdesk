// RF-03 — Cambio de contraseña (logueado) web — Stitch + NIST 800-63B
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { theme, validatePassword, validatePasswordSync, PasswordStrength, Card, Button } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function ChangePasswordScreen({ navigation }: { navigation?: { goBack: () => void } }) {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const sync = useMemo(
    () => (next ? validatePasswordSync(next, { email: profile?.email ?? undefined, nombre: profile?.full_name ?? undefined, rol: profile?.rol }) : null),
    [next, profile],
  );

  const onSubmit = async () => {
    setServerError(null);
    setOk(false);
    if (!next || !confirm) {
      setServerError('Completa los campos');
      return;
    }
    if (next !== confirm) {
      setServerError('Las contraseñas no coinciden');
      return;
    }
    const ctx = { email: profile?.email ?? undefined, nombre: profile?.full_name ?? undefined, rol: profile?.rol };
    const syncCheck = validatePasswordSync(next, ctx);
    if (!syncCheck.ok) {
      setServerError(syncCheck.reasons[0]);
      return;
    }
    setLoading(true);
    try {
      const full = await validatePassword(next, ctx);
      if (!full.ok) {
        setServerError(full.reasons[0]);
        return;
      }
      if (profile?.email && current) {
        const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: profile.email, password: current });
        if (reauthErr) {
          setServerError('Contraseña actual incorrecta');
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setOk(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={[s.scroll, isDesktop && s.scrollDesktop]} style={{ flex: 1 }}>
        <View style={s.hero}>
          <View style={s.hairline} />
          <Text style={s.eyebrow}>Seguridad · NIST 800-63B</Text>
          <Text style={s.title}>Cambiar contraseña</Text>
          <Text style={s.subtitle}>8–64 caracteres · sin composición forzada · verificada contra filtraciones (HIBP fail-closed)</Text>
        </View>
        <View style={s.body}>
          <View style={[s.card, isDesktop ? { width: 440, alignSelf: 'center' } : { width: '100%' }]}>
            <Text style={s.label}>Contraseña actual</Text>
            <TextInput placeholder="••••••••" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry value={current} onChangeText={setCurrent} style={s.input} />
            <Text style={s.label}>Nueva contraseña</Text>
            <TextInput placeholder="Mín. 8 caracteres" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry value={next} onChangeText={setNext} style={s.input} />
            <PasswordStrength validation={sync} />
            <TextInput
              placeholder="Confirmar nueva"
              placeholderTextColor={theme.colors.mutedSoft}
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              style={[s.input, next && confirm && next !== confirm ? s.inputError : null]}
            />
            {next && confirm && next !== confirm ? <Text style={s.inlineError}>No coinciden</Text> : null}
            {serverError ? (
              <View style={s.errorBox}>
                <Text style={s.error}>{serverError}</Text>
              </View>
            ) : null}
            {ok ? (
              <View style={[s.errorBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Text style={[s.error, { color: '#065F46' }]}>Contraseña actualizada. Se cerrarán otras sesiones por seguridad.</Text>
              </View>
            ) : null}
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Pressable onPress={onSubmit} style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.92 } ]}>
                <Text style={s.primaryText}>Actualizar contraseña</Text>
              </Pressable>
            )}
            <Pressable onPress={() => navigation?.goBack?.()} style={s.back}>
              <Text style={s.backText}>← Volver</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flexGrow: 1 },
  scrollDesktop: { minHeight: '100%' as unknown as number },
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 6, maxWidth: 440, width: '100%', alignSelf: 'center' },
  hairline: { height: 2, width: 32, backgroundColor: theme.colors.accent, borderRadius: 999 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' as const, color: theme.colors.accentStrong },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: theme.colors.muted, lineHeight: 18 },
  body: { paddingHorizontal: 16, paddingTop: 8, flex: 1 },
  card: { gap: 10, padding: 18, borderRadius: theme.radius.xl, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft } as unknown as object,
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' as const, color: theme.colors.textSoft },
  input: { borderWidth: 1.2, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FFFEFB', fontSize: 14, color: theme.colors.text },
  inputError: { borderColor: '#FCA5A5' },
  inlineError: { color: '#7F1D1D', fontSize: 11, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 10 },
  error: { color: '#7F1D1D', fontSize: 12, fontWeight: '600' },
  primaryBtn: { backgroundColor: theme.colors.primary, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  back: { alignItems: 'center', paddingVertical: 6 },
  backText: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
});
