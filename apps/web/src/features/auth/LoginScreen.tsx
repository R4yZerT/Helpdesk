// RF-01 / RF-04 — Login Corporativo Stitch (HelpDesk - Login Corporativo 0500513c)
// Screenshot 0500513c Desktop & Mobile — fidelity #0E87E2 / #FD7C06 / #F6F8FB / Inter+JetBrains
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { theme } from '@helpdesk/shared';
import { useAuth } from '../../context/AuthContext';

export function LoginScreen({ navigation }: { navigation?: { navigate: (r: string) => void } }) {
  const { signIn, error, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLocalError(null);
    if (!identifier.trim() || !password) { setLocalError('Cédula/correo y contraseña requeridos'); return; }
    try { await signIn(identifier.trim(), password); } catch (e) { setLocalError(e instanceof Error ? e.message : 'Error de autenticación'); }
  };

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={[s.scroll, isDesktop && s.scrollDesktop]} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        {/* Top brand bar — Stitch header */}
        <View style={s.topBar}>
          <View style={s.topBarInner}>
            <View style={s.brandRow}>
              <View style={s.mark}><Text style={s.markText}>◈</Text></View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.brandTitle}>HelpDesk</Text>
                  <Text style={s.badge}>v4.8-PROD</Text>
                </View>
                <Text style={s.brandSub}>Gestión de solicitudes</Text>
              </View>
            </View>
            <View style={s.topRightPill}><Text style={s.topRightText}>● Sistemas Operativos</Text></View>
          </View>
        </View>

        {/* Center card — max 440 */}
        <View style={[s.centerWrap, isDesktop && { paddingVertical: 32 }]}>
          <View style={[s.card, isDesktop ? { width: 440 } : { width: '100%' }]}>
            <View style={s.kickerRow}>
              <Text style={s.kicker}>ACCESO SEGURO</Text>
              <Text style={s.kickerDot}>·</Text>
              <Text style={s.kickerSoft}>v4.8</Text>
            </View>
            <Text style={s.h1}>Inicia sesión</Text>
            <Text style={s.sub}>Accede con tu cuenta corporativa</Text>

            {(localError || error) ? (
              <View style={s.errorBox} accessible accessibilityRole="alert">
                <Text style={s.errorText}>{localError ?? error}</Text>
              </View>
            ) : null}

            <View style={s.field}>
              <Text style={s.label}>Cédula o correo corporativo *</Text>
              <View style={s.inputWrap}>
                <Text style={s.inputIcon}>🪪</Text>
                <TextInput
                  placeholder="1023456789 o tu.correo@empresa.com"
                  placeholderTextColor={theme.colors.mutedSoft}
                  autoCapitalize="none"
                  keyboardType="default"
                  value={identifier}
                  onChangeText={setIdentifier}
                  style={s.input}
                  accessibilityLabel="Cédula o correo"
                />
              </View>
            </View>

            <View style={s.field}>
              <View style={s.labelRow}>
                <Text style={s.label}>Contraseña *</Text>
                <Pressable onPress={() => navigation?.navigate('ForgotPassword' as never)}><Text style={s.forgotLink}>¿Olvidaste tu contraseña?</Text></Pressable>
              </View>
              <View style={s.inputWrap}>
                <Text style={s.inputIcon}>🔒</Text>
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.mutedSoft}
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                  style={[s.input, { flex: 1 }]}
                  accessibilityLabel="Contraseña"
                />
                <Pressable onPress={() => setShowPass((v) => !v)} style={s.eyeBtn} accessibilityRole="button" accessibilityLabel={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  <Text style={s.eyeText}>{showPass ? '🙈' : '👁'}</Text>
                </Pressable>
              </View>
              <View style={s.strengthRow}>
                <View style={s.strengthBar}><View style={[s.strengthFill, { width: '66%' }]} /></View>
                <Text style={s.strengthText}>Nivel de seguridad: <Text style={{ color: theme.colors.success, fontWeight: '700' }}>Medio-Alto</Text></Text>
                <Text style={s.strengthHint}>Mín. 8 caracteres</Text>
              </View>
            </View>

            <Pressable onPress={() => setRemember((v) => !v)} style={s.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: remember }}>
              <View style={[s.checkBox, remember && s.checkBoxActive]}>{remember ? <Text style={s.checkTick}>✓</Text> : null}</View>
              <Text style={s.checkLabel}>Recordarme en este equipo</Text>
            </Pressable>

            <Pressable onPress={onSubmit} disabled={loading} style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.92 }, loading && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Ingresar">
              <Text style={s.primaryText}>{loading ? 'Ingresando…' : 'Ingresar  →'}</Text>
            </Pressable>

            <View style={s.dividerRow}><View style={s.divider} /><Text style={s.dividerText}>o</Text><View style={s.divider} /></View>

            <Pressable onPress={() => setLocalError('SSO no configurado — usa correo y contraseña')} style={s.secondaryBtn} accessibilityRole="button">
              <Text style={s.secondaryIcon}>▦</Text><Text style={s.secondaryText}>Ingresar con SSO Empresarial</Text>
            </Pressable>

            <Text style={s.legal}>Al ingresar, aceptas la política de privacidad y uso de tecnologías.</Text>
            <View style={s.supportRow}>
              <Text style={s.supportLabel}>Soporte TI ·</Text><Text style={s.supportLink}> soporte@helpdesk.local</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  scrollDesktop: { paddingHorizontal: 0 },
  topBar: { backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: 16, paddingVertical: 10 },
  topBarInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1280, width: '100%', alignSelf: 'center' },
  brandRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  mark: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  brandTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  badge: { fontSize: 9, fontWeight: '700', color: theme.colors.primary, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  brandSub: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', marginTop: 1 },
  topRightPill: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  topRightText: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 20 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 24, gap: 14, ...theme.shadow.soft } as any,
  kickerRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.colors.primary, textTransform: 'uppercase' as const },
  kickerDot: { color: theme.colors.borderStrong, fontSize: 10 },
  kickerSoft: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '600' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4, marginTop: -6 },
  sub: { fontSize: 12, color: theme.colors.muted, marginTop: -8 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 10 },
  errorText: { color: '#7F1D1D', fontSize: 12, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.colors.textSoft },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotLink: { fontSize: 10, color: theme.colors.primary, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, paddingHorizontal: 10, height: 44, gap: 8 },
  inputIcon: { fontSize: 12, color: theme.colors.mutedSoft },
  input: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  eyeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  eyeText: { fontSize: 13, color: theme.colors.mutedSoft },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  strengthBar: { flex: 1, height: 4, backgroundColor: theme.colors.border, borderRadius: 999, overflow: 'hidden', minWidth: 80 },
  strengthFill: { height: 4, backgroundColor: theme.colors.success, borderRadius: 999 },
  strengthText: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '600' },
  strengthHint: { fontSize: 10, color: theme.colors.mutedSoft, marginLeft: 'auto' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  checkBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkTick: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: -1 },
  checkLabel: { fontSize: 11, color: theme.colors.textSoft, fontWeight: '600' },
  primaryBtn: { backgroundColor: theme.colors.primary, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { fontSize: 11, color: theme.colors.mutedSoft, fontWeight: '600' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  secondaryIcon: { fontSize: 12, color: theme.colors.primary },
  secondaryText: { fontSize: 12, color: theme.colors.textSoft, fontWeight: '700' },
  legal: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'center', lineHeight: 14 },
  supportRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  supportLabel: { fontSize: 10, color: theme.colors.mutedSoft },
  supportLink: { fontSize: 10, color: theme.colors.primary, fontWeight: '600' },
});
