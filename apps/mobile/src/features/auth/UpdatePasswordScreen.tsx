// RF-03 — Nueva contraseña tras recovery link (helpdesk://reset-password)
// Los tokens llegan por deep-link; AuthProvider los guarda y mantiene recoveryPending
// para que el AuthNavigator siga montado hasta completar el flujo.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme, validatePassword, validatePasswordSync, Card, Button, useFeedback } from '@helpdesk/shared';
import { PasswordStrength } from '../../components/PasswordStrength';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { consumeRecoveryTokens } from '../../lib/recovery-link';

export function UpdatePasswordScreen() {
  const { profile, clearRecovery } = useAuth();
  const [sessionOk, setSessionOk] = useState(false);
  const [booting, setBooting] = useState(true);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fb = useFeedback();

  // Canjea los tokens del enlace por sesión de recovery al montar
  useEffect(() => {
    let alive = true;
    (async () => {
      const tokens = consumeRecoveryTokens();
      if (!tokens) {
        if (alive) {
          setServerError('Enlace inválido o expirado. Solicita uno nuevo desde “¿Olvidaste tu contraseña?”.');
          setBooting(false);
        }
        return;
      }
      try {
        const { error } = await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
        if (error) throw error;
        if (alive) setSessionOk(true);
      } catch (e) {
        if (alive) setServerError(e instanceof Error ? e.message : 'No se pudo validar el enlace de recuperación.');
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ctx = {
    email: profile?.email ?? undefined,
    nombre: profile?.full_name ?? undefined,
    rol: profile?.rol,
  };
  const sync = useMemo(() => (next ? validatePasswordSync(next, ctx) : null), [next, profile]);

  const onSubmit = async () => {
    setServerError(null);
    if (!next || !confirm) {
      setServerError('Completa los campos');
      return;
    }
    if (next !== confirm) {
      setServerError('Las contraseñas no coinciden');
      return;
    }
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
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      fb.show('Contraseña actualizada', 'Ya puedes usar el aplicativo con tu nueva contraseña.', 'success', {
        onConfirm: () => clearRecovery(),
      });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={s.hero}>
        <View style={s.hairline} />
        <Text style={s.eyebrow}>Recuperación · NIST 800-63B</Text>
        <Text style={s.title}>Crea tu nueva contraseña</Text>
        <Text style={s.subtitle}>8–64 caracteres · se verificará contra filtraciones conocidas.</Text>
      </View>
      <View style={s.body}>
        <Card style={s.card}>
          {booting ? (
            <ActivityIndicator />
          ) : !sessionOk ? (
            <View style={s.errorBox}>
              <Text style={s.error}>{serverError ?? 'Enlace inválido o expirado.'}</Text>
            </View>
          ) : (
            <>
              <Text style={s.label}>Nueva contraseña</Text>
              <TextInput placeholder="Mín. 8 caracteres" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry value={next} onChangeText={setNext} style={s.input} />
              <PasswordStrength validation={sync} />
              <Text style={s.label}>Confirmar nueva</Text>
              <TextInput placeholder="Repite la contraseña" placeholderTextColor={theme.colors.mutedSoft} secureTextEntry value={confirm} onChangeText={setConfirm} style={[s.input, next && confirm && next !== confirm ? s.inputError : null]} />
              {next && confirm && next !== confirm ? <Text style={s.error}>No coinciden</Text> : null}
              {serverError ? <View style={s.errorBox}><Text style={s.error}>{serverError}</Text></View> : null}
              {loading ? <ActivityIndicator /> : <Button title="Guardar nueva contraseña" onPress={onSubmit} variant="brass" disabled={loading || !next || !confirm} />}
            </>
          )}
        </Card>
      </View>
      {fb.modal}
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
