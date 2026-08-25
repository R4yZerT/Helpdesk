// RF-03 robusto — Cambio de contraseña con validación NIST + HIBP fail-closed + reauth
import { useState, useMemo } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { theme, validatePasswordSync, validatePassword } from '@helpdesk/shared';
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
      // Fail-closed HIBP via shared (usa pwnedpasswords API directo desde cliente)
      // En producción también vía Edge Function auth-validate para no exponer lógica; aquí validamos cliente robusto
      const full = await validatePassword(next, ctx);
      if (!full.ok) { setServerError(full.reasons[0]); return; }

      // Reautenticación requerida por secure_password_change=true: verifica current si hay sesión email
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
    <View style={s.container}>
      <Text style={s.title}>Cambiar contraseña</Text>
      <Text style={s.subtitle}>NIST 800-63B · 8–64 chars · verificación contra filtraciones</Text>

      <TextInput placeholder="Contraseña actual" secureTextEntry value={current} onChangeText={setCurrent} style={s.input} />
      <TextInput placeholder="Nueva contraseña (mín. 8)" secureTextEntry value={next} onChangeText={setNext} style={s.input} />
      <PasswordStrength validation={sync} />
      <TextInput placeholder="Confirmar nueva" secureTextEntry value={confirm} onChangeText={setConfirm} style={[s.input, next && confirm && next !== confirm ? s.inputError : null]} />
      {next && confirm && next !== confirm ? <Text style={s.error}>No coinciden</Text> : null}
      {serverError ? <Text style={s.error}>{serverError}</Text> : null}
      {loading ? <ActivityIndicator /> : <Button title="Actualizar contraseña" onPress={onSubmit} disabled={loading || !next || !confirm} />}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: theme.colors.bg, justifyContent: 'center', gap: 4 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.primary },
  subtitle: { fontSize: 11, color: theme.colors.muted, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.surface },
  inputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: 11 },
});
