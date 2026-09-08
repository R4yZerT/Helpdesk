// RF-03 — Cambio de contraseña (logueado) web — Stitch + NIST 800-63B
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { theme, validatePassword, validatePasswordSync, PasswordStrength, Card, Button, IconEye, IconEyeOff, IconLock } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function ChangePasswordScreen({ navigation }: { navigation?: { goBack: () => void } }) {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
            <View style={s.inputWrap}>
              <View style={s.inputIconWrap}><IconLock size={14} color={theme.colors.mutedSoft} /></View>
              <TextInput placeholder="••••••••" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry={!showCurrent} value={current} onChangeText={setCurrent} style={s.inputInner} />
              <Pressable onPress={() => setShowCurrent((v) => !v)} style={s.eyeBtn} accessibilityRole="button" accessibilityLabel={showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showCurrent ? <IconEyeOff size={18} color={theme.colors.mutedSoft} /> : <IconEye size={18} color={theme.colors.mutedSoft} />}</Pressable>
            </View>
            <Text style={s.label}>Nueva contraseña</Text>
            <View style={s.inputWrap}>
              <View style={s.inputIconWrap}><IconLock size={14} color={theme.colors.mutedSoft} /></View>
              <TextInput placeholder="Mín. 8 caracteres" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry={!showNext} value={next} onChangeText={setNext} style={s.inputInner} />
              <Pressable onPress={() => setShowNext((v) => !v)} style={s.eyeBtn} accessibilityRole="button" accessibilityLabel={showNext ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showNext ? <IconEyeOff size={18} color={theme.colors.mutedSoft} /> : <IconEye size={18} color={theme.colors.mutedSoft} />}</Pressable>
            </View>
            <PasswordStrength validation={sync} />
            <View style={[s.inputWrap, next && confirm && next !== confirm ? s.inputWrapError : null]}>
              <View style={s.inputIconWrap}><IconLock size={14} color={theme.colors.mutedSoft} /></View>
              <TextInput
                placeholder="Confirmar nueva"
                placeholderTextColor={theme.colors.mutedSoft}
                secureTextEntry={!showConfirm}
                value={confirm}
                onChangeText={setConfirm}
                style={s.inputInner}
              />
              <Pressable onPress={() => setShowConfirm((v) => !v)} style={s.eyeBtn} accessibilityRole="button" accessibilityLabel={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showConfirm ? <IconEyeOff size={18} color={theme.colors.mutedSoft} /> : <IconEye size={18} color={theme.colors.mutedSoft} />}</Pressable>
            </View>
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
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: '#FFFEFB', paddingHorizontal: 10, height: 44, gap: 8 },
  inputWrapError: { borderColor: '#FCA5A5' },
  inputIcon: { fontSize: 12, color: theme.colors.mutedSoft },
  inputIconWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  inputInner: { flex: 1, fontSize: 14, color: theme.colors.text, paddingVertical: 0 },
  eyeBtn: { paddingHorizontal: 6, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  eyeText: { fontSize: 13, color: theme.colors.mutedSoft },
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
