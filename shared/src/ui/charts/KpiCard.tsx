// KpiCard — Stitch 4 KPIs + sparkline
import * as React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';

export function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  accent,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'warn';
  accent?: 'orange' | 'blue';
}) {
  return (
    <Card style={[s.card, accent === 'orange' ? s.accentOrange : null as unknown as ViewStyle]}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
      {delta ? <Text style={[s.delta, deltaTone === 'warn' && { color: theme.colors.accent }]}>{delta}</Text> : null}
      <View style={s.sparkWrap}>
        <View style={[s.spark, accent === 'orange' ? { backgroundColor: theme.colors.accent } : { backgroundColor: theme.colors.primary }]} />
        <View style={s.sparkBg} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, minWidth: 140, gap: 6, padding: 16 },
  accentOrange: { borderRightWidth: 3, borderRightColor: theme.colors.accent },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.mutedSoft },
  value: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 },
  delta: { fontSize: 11, fontWeight: '600', color: theme.colors.success },
  sparkWrap: { height: 18, marginTop: 6, justifyContent: 'center' },
  sparkBg: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: theme.colors.surfaceAlt, borderRadius: 999 },
  spark: { height: 2, borderRadius: 999, width: '70%' },
});
