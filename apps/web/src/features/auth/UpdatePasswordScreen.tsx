// RF-03 — Update password tras recovery link (supabase.auth recovery session)
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { theme, validatePassword, validatePasswordSync, PasswordStrength, IconEye, IconEyeOff, IconLock } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

export function UpdatePasswordScreen({ navigation }: { navigation?: { navigate: (r: string) => void } }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const sync = useMemo(() => (next ? validatePasswordSync(next, {}) : null), [next]);

  const onSubmit = async () => {
    setError(null);
    if (!next || !confirm) {
      setError('Completa los campos');
      return;
    }
    if (next !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    const syncCheck = validatePasswordSync(next, {});
    if (!syncCheck.ok) {
      setError(syncCheck.reasons[0]);
      return;
    }
    setLoading(true);
    try {
      const full = await validatePassword(next, {});
      if (!full.ok) {
        setError(full.reasons[0]);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (ok) {
    return (
      <View style={[s.page, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={[s.card, isDesktop ? { width: 440 } : { width: '100%' }]}>
          <Text style={s.title}>Contraseña actualizada</Text>
          <Text style={s.subtitle}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
          <Pressable onPress={() => navigation?.navigate?.('Login')} style={s.primaryBtn as unknown as object}>
            <Text style={s.primaryText}>Ir a inicio de sesión</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={[s.scroll, isDesktop && s.scrollDesktop]} style={{ flex: 1 }}>
        <View style={[s.centerWrap, isDesktop && { paddingVertical: 32 }]}>
          <View style={[s.card, isDesktop ? { width: 440 } : { width: '100%' }]}>
            <View style={s.kickerRow}>
              <Text style={s.kicker}>RECUPERACIÓN</Text>
              <Text style={s.kickerDot}>·</Text>
              <Text style={s.kickerSoft}>v4.8</Text>
            </View>
            <Text style={s.h1}>Crea tu nueva contraseña</Text>
            <Text style={s.sub}>8–64 caracteres · se verificará contra filtraciones conocidas.</Text>
            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}
            <View style={s.field}>
              <Text style={s.label}>Nueva contraseña *</Text>
              <View style={s.inputWrap}>
                <View style={s.inputIconWrap}><IconLock size={14} color={theme.colors.mutedSoft} /></View>
                <TextInput placeholder="Mín. 8 caracteres" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry={!showNext} value={next} onChangeText={setNext} style={s.inputInner} />
                <Pressable onPress={() => setShowNext((v) => !v)} style={s.eyeBtn} accessibilityRole="button" accessibilityLabel={showNext ? 'Ocultar' : 'Mostrar'}>{showNext ? <IconEyeOff size={18} color={theme.colors.mutedSoft} /> : <IconEye size={18} color={theme.colors.mutedSoft} />}</Pressable>
              </View>
              <PasswordStrength validation={sync} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Confirmar *</Text>
              <View style={[s.inputWrap, next && confirm && next !== confirm ? s.inputWrapError : null]}>
                <View style={s.inputIconWrap}><IconLock size={14} color={theme.colors.mutedSoft} /></View>
                <TextInput placeholder="Repite la contraseña" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry={!showConfirm} value={confirm} onChangeText={setConfirm} style={s.inputInner} />
                <Pressable onPress={() => setShowConfirm((v) => !v)} style={s.eyeBtn} accessibilityRole="button" accessibilityLabel={showConfirm ? 'Ocultar' : 'Mostrar'}>{showConfirm ? <IconEyeOff size={18} color={theme.colors.mutedSoft} /> : <IconEye size={18} color={theme.colors.mutedSoft} />}</Pressable>
              </View>
              {next && confirm && next !== confirm ? <Text style={s.inlineError}>No coinciden</Text> : null}
            </View>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Pressable onPress={onSubmit} style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.92 }] as unknown as object}>
                <Text style={s.primaryText}>Guardar nueva contraseña</Text>
              </Pressable>
            )}
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
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 20 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: 24, gap: 14, ...theme.shadow.soft } as unknown as object,
  kickerRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.colors.primary, textTransform: 'uppercase' as const },
  kickerDot: { color: theme.colors.borderStrong, fontSize: 10 },
  kickerSoft: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '600' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4, marginTop: -6 },
  sub: { fontSize: 12, color: theme.colors.muted, marginTop: -8 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 10 },
  errorText: { color: '#7F1D1D', fontSize: 12, fontWeight: '600' },
  inlineError: { color: '#7F1D1D', fontSize: 11, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' as const, color: theme.colors.textSoft },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: 8, backgroundColor: theme.colors.surface, paddingHorizontal: 10, height: 44, gap: 8 } as unknown as object,
  inputWrapError: { borderColor: '#FCA5A5' } as unknown as object,
  inputIcon: { fontSize: 12, color: theme.colors.mutedSoft },
  inputIconWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  inputInner: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  eyeBtn: { paddingHorizontal: 6, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  eyeText: { fontSize: 13, color: theme.colors.mutedSoft },
  input: { borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: 8, backgroundColor: theme.colors.surface, paddingHorizontal: 12, height: 44, fontSize: 13, color: theme.colors.text } as unknown as object,
  inputError: { borderColor: '#FCA5A5' },
  primaryBtn: { backgroundColor: theme.colors.primary, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  subtitle: { fontSize: 12, color: theme.colors.muted, textAlign: 'center' },
});
