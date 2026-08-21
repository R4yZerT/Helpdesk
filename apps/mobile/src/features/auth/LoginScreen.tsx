// RF-01 / RF-04 — Login placeholder (UI real en siguiente iteracion)
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@helpdesk/shared';
import { useAuth } from '../../context/AuthContext';

export function LoginScreen() {
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
      await signIn(email, password);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Error de autenticación');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <Text style={styles.subtitle}>Correo corporativo + contraseña (NIST 800-63B)</Text>
      <TextInput
        placeholder="correo@iue.edu.co"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Contraseña (min 8)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {(localError || error) && <Text style={styles.error}>{localError ?? error}</Text>}
      <Button title={loading ? 'Ingresando…' : 'Ingresar'} onPress={onSubmit} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: theme.colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.primary },
  subtitle: { marginTop: 4, color: theme.colors.muted, fontSize: 12 },
  input: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: 12,
    marginTop: 12,
    backgroundColor: theme.colors.surface,
  },
  error: { color: theme.colors.danger, marginTop: 8, fontSize: 12 },
});
