// RF-01 / RF-04 — Login IUE elegante (warm paper + ink + brass)
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { theme, Card, Button } from '@helpdesk/shared';
import { useAuth } from '../../context/AuthContext';

export function LoginScreen({ navigation }: { navigation?: { navigate: (r: string) => void } }) {
  const { signIn, error, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLocalError(null);
    if (!email || !password) {
      setLocalError('Correo y contraseña requeridos');
      return;
    }
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Error de autenticación');
    }
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} style={{ flex: 1, backgroundColor: theme.colors.bg }} keyboardShouldPersistTaps="handled">
      {/* Header hero */}
      <View style={s.hero}>
        <View style={s.heroHairline} />
        {/* Imagen hero — pon tu archivo en apps/mobile/assets/login-hero.png y descomenta la línea */}
        {/* Descomenta cuando el archivo exista: */}
        {/* <Image source={require('../../../assets/login-hero.png')} style={s.heroImage} resizeMode="cover" /> */}
        <View style={s.brandRow}>
          <View style={s.mark}>
            <Text style={s.markText}>IUE</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Institución Universitaria de Envigado</Text>
            <Text style={s.heroTitle}>Mesa de Ayuda</Text>
            <Text style={s.heroSub}>Soporte TIC · elegante, rápido, trazable</Text>
          </View>
        </View>
      </View>

      <View style={s.body}>
        <Card style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.title}>Bienvenido</Text>
            <Text style={s.subtitle}>Ingresa con tu correo corporativo</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Correo</Text>
            <TextInput
              placeholder="nombre@iue.edu.co"
              placeholderTextColor={theme.colors.mutedSoft}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={s.input}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Contraseña</Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor={theme.colors.mutedSoft}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={s.input}
            />
            <Text style={s.hint}>Mín. 8 caracteres · NIST 800-63B</Text>
          </View>

          {(localError || error) ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{localError ?? error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 4 }}>
            <Button title={loading ? 'Ingresando…' : 'Ingresar'} onPress={onSubmit} variant="primary" disabled={loading} />
          </View>

          <View style={s.dividerRow}>
            <View style={s.divider} />
            <Text style={s.dividerText}>o</Text>
            <View style={s.divider} />
          </View>

          <Pressable onPress={() => navigation?.navigate('ForgotPassword' as never)} style={s.linkBtn}>
            <Text style={s.link}>¿Olvidaste tu contraseña?</Text>
            <Text style={s.linkSub}>Te enviamos un enlace seguro · expira en 1h</Text>
          </Pressable>
        </Card>

        <View style={s.footer}>
          <Text style={s.footerText}>Sesión 12h · Inactividad 30m · MFA para jefe / admin</Text>
          <Text style={s.footerDot}>—</Text>
          <Text style={s.footerTextSoft}>Hecho con cuidado en Envigado</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 24 },
  hero: { paddingTop: 28, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: theme.colors.bg },
  heroHairline: { height: 2, backgroundColor: theme.colors.accent, borderRadius: 999, width: 36, marginBottom: 14 },
  heroImage: { width: '100%', height: 180, borderRadius: theme.radius.lg, marginBottom: 16, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border } as any,
  brandRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  mark: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1A2540' },
  markText: { color: theme.colors.accent, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', color: theme.colors.accentStrong },
  heroTitle: { fontSize: 28, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.6, marginTop: 2 },
  heroSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  body: { paddingHorizontal: 16, gap: 14 },
  card: { padding: 18, gap: 14, borderRadius: theme.radius.xl },
  cardHeader: { gap: 4, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: theme.colors.muted },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: theme.colors.textSoft },
  input: {
    borderColor: theme.colors.border,
    borderWidth: 1.2,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    backgroundColor: '#FFFEFB',
    color: theme.colors.text,
  },
  hint: { fontSize: 11, color: theme.colors.mutedSoft },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 10 },
  errorText: { color: '#7F1D1D', fontSize: 12, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  divider: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { fontSize: 11, color: theme.colors.mutedSoft, fontWeight: '600' },
  linkBtn: { alignItems: 'center', gap: 3, paddingVertical: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt },
  link: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  linkSub: { color: theme.colors.muted, fontSize: 11 },
  footer: { alignItems: 'center', gap: 4, paddingTop: 8 },
  footerText: { fontSize: 11, color: theme.colors.muted, textAlign: 'center' },
  footerTextSoft: { fontSize: 11, color: theme.colors.mutedSoft },
  footerDot: { color: theme.colors.borderStrong },
});
