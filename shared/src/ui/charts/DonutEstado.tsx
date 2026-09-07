// DonutEstado — Stitch r60 circ377 6 estados + legend (sin svg lib, barras como fallback accesible)
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';

const COLORS: Record<string, string> = {
  en_proceso: theme.colors.primary,
  solucionado: theme.colors.success,
  abierto: theme.colors.borderStrong,
  cerrado: theme.colors.text,
  devuelto: theme.colors.accent,
  programado: theme.colors.mutedSoft,
};

export function DonutEstado({ data }: { data: { estado: string; count: number }[] }) {
  const total = data.reduce((a, b) => a + b.count, 0) || 1;
  return (
    <Card style={{ gap: 12 }}>
      <Text style={s.title}>Distribución por Estado</Text>
      <View style={s.donutRow}>
        <View style={s.donut}>
          <Text style={s.centerNum}>{total}</Text>
          <Text style={s.centerLabel}>activos</Text>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          {data.map((d) => (
            <View key={d.estado} style={s.legendRow}>
              <View style={[s.dot, { backgroundColor: COLORS[d.estado] ?? theme.colors.muted }]} />
              <Text style={s.legendLabel}>{d.estado.replace('_', ' ')}</Text>
              <Text style={s.legendCount}>{d.count}</Text>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${Math.round((d.count / total) * 100)}%`, backgroundColor: COLORS[d.estado] ?? theme.colors.muted }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  donutRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  donut: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 14,
    borderColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  centerNum: { fontSize: 18, fontWeight: '800', color: theme.colors.text, lineHeight: 18 },
  centerLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.muted },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.textSoft, textTransform: 'capitalize', flex: 1 },
  legendCount: { fontSize: 11, fontWeight: '800', color: theme.colors.text, minWidth: 20, textAlign: 'right' },
  barBg: { width: 56, height: 6, backgroundColor: theme.colors.surfaceAlt, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
});
