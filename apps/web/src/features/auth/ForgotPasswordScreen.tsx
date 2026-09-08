// RF-03 — Recuperación web (Stitch: #0E87E2 / #FD7C06 / #F6F8FB)
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { theme, Card, Button } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

export function ForgotPasswordScreen({ navigation }: { navigation?: { navigate: (r: string) => void; goBack: () => void } }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.includes('@')) {
      setError('Correo inválido');
      return;
    }
    setLoading(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/#UpdatePassword` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={[s.scroll, isDesktop && s.scrollDesktop]} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <View style={s.topBar}>
          <View style={s.topBarInner}>
            <View style={s.brandRow}>
              <View style={s.mark}>
                <Text style={s.markText}>◈</Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.brandTitle}>HelpDesk</Text>
                  <Text style={s.badge}>v4.8</Text>
                </View>
                <Text style={s.brandSub}>Gestión de solicitudes</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={[s.centerWrap, isDesktop && { paddingVertical: 32 }]}>
          <View style={[s.card, isDesktop ? { width: 440 } : { width: '100%' }]}>
            <View style={s.kickerRow}>
              <Text style={s.kicker}>RECUPERACIÓN SEGURA</Text>
              <Text style={s.kickerDot}>·</Text>
              <Text style={s.kickerSoft}>v4.8</Text>
            </View>
            <Text style={s.h1}>Restablece tu acceso</Text>
            <Text style={s.sub}>Te enviamos un enlace único a tu correo corporativo. Válido 1 hora · límite 60s entre envíos.</Text>
            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}
            {sent ? (
              <View style={[s.errorBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Text style={[s.errorText, { color: '#065F46' }]}>Correo enviado. Revisa tu bandeja (y spam/Inbucket en local).</Text>
              </View>
            ) : null}
            <View style={s.field}>
              <Text style={s.label}>Correo corporativo *</Text>
              <View style={s.inputWrap}>
                <Text style={s.inputIcon}>✉</Text>
                <TextInput
                  placeholder="correo@iue.edu.co"
                  placeholderTextColor={theme.colors.mutedSoft}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  style={s.input}
                />
              </View>
            </View>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Pressable onPress={onSubmit} style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.92 }]}>
                <Text style={s.primaryText}>{sent ? 'Reenviar enlace' : 'Enviar enlace'}</Text>
              </Pressable>
            )}
            {sent ? <Text style={s.hint}>Si no llega, espera 60s y reintenta.</Text> : null}
            <Pressable onPress={() => navigation?.goBack?.()} style={s.back}>
              <Text style={s.backText}>← Volver al ingreso</Text>
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
  topBar: { height: 56, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, justifyContent: 'center' },
  topBarInner: { maxWidth: 1280, width: '100%', alignSelf: 'center', paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  mark: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  brandTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  badge: { fontSize: 9, fontWeight: '700', color: theme.colors.primary, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  brandSub: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', marginTop: 1 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 20 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 24, gap: 14, ...theme.shadow.soft } as unknown as object,
  kickerRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.colors.primary, textTransform: 'uppercase' as const },
  kickerDot: { color: theme.colors.borderStrong, fontSize: 10 },
  kickerSoft: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '600' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4, marginTop: -6 },
  sub: { fontSize: 12, color: theme.colors.muted, marginTop: -8, lineHeight: 16 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 10 },
  errorText: { color: '#7F1D1D', fontSize: 12, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' as const, color: theme.colors.textSoft },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, paddingHorizontal: 10, height: 44, gap: 8 },
  inputIcon: { fontSize: 12, color: theme.colors.mutedSoft },
  input: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  primaryBtn: { backgroundColor: theme.colors.primary, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
  hint: { fontSize: 11, color: theme.colors.mutedSoft, textAlign: 'center' },
  back: { alignItems: 'center', paddingVertical: 6 },
  backText: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
});
