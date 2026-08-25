// Componente fortaleza contraseña — NIST 800-63B feedback sin composition enforcement
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '@helpdesk/shared';
import type { PasswordValidation } from '@helpdesk/shared';
import { strengthLabel } from '@helpdesk/shared';

const COLORS: Record<PasswordValidation['strength'], string> = {
  muy_debil: theme.colors.danger,
  debil: '#f59e0b',
  aceptable: '#3b82f6',
  fuerte: '#10b981',
};

export function PasswordStrength({ validation }: { validation: PasswordValidation | null }) {
  if (!validation) return null;
  const pct = ([0, 25, 50, 75, 100] as const)[validation.score];
  return (
    <View style={s.wrap}>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: COLORS[validation.strength] }]} />
      </View>
      <Text style={[s.label, { color: COLORS[validation.strength] }]}>{strengthLabel(validation.strength)} · {validation.score}/4</Text>
      {validation.reasons.map((r) => (
        <Text key={r} style={s.reason}>• {r}</Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 8, gap: 4 },
  barBg: { height: 6, backgroundColor: theme.colors.border, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
  label: { fontSize: 11, fontWeight: '600' },
  reason: { fontSize: 11, color: theme.colors.danger },
});
