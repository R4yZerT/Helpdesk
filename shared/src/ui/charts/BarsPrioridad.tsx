// BarsPrioridad — 4 prioridades normalizadas + header con total (distinto a Donut por Estado)
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';

export function BarsPrioridad({ data }: { data: { prioridad: string; count: number }[] }) {
  const PRIORIDADES_ORDEN = ['critica', 'alta', 'media', 'baja'] as const;
  const byPri = new Map(data.map((d) => [d.prioridad, d.count]));
  const filled = PRIORIDADES_ORDEN.map((k) => ({ prioridad: k, count: byPri.get(k) ?? 0 }));
  const total = filled.reduce((a, b) => a + b.count, 0) || 1;
  const colorMap: Record<string, string> = {
    critica: theme.colors.accent,
    alta: '#FB923C',
    media: theme.colors.primary,
    baja: theme.colors.borderStrong,
  };
  return (
    <Card style={{ gap: 12 }}>
      <View style={s.header}><Text style={s.title}>Carga por Prioridad</Text><Text style={s.subtitle}>{total} tickets · urgencia</Text></View>
      {filled.map((d) => {
        const pct = Math.round((d.count / total) * 100);
        return (
          <View key={d.prioridad} style={s.row}>
            <Text style={s.label}>{d.prioridad}</Text>
            <View style={s.barBg}>
              <View style={[s.barFill, { width: `${pct}%`, backgroundColor: colorMap[d.prioridad] ?? theme.colors.muted }]} />
            </View>
            <Text style={s.pct}>{pct}%</Text>
            <Text style={s.count}>{d.count}</Text>
          </View>
        );
      })}
      <Text style={s.footer}>SLA Máximo Crítica 60 min · Prioridad = urgencia (no confundir con Estado)</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  subtitle: { fontSize: 10, fontWeight: '600', color: theme.colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 11, fontWeight: '700', color: theme.colors.textSoft, textTransform: 'capitalize', width: 52 },
  barBg: { flex: 1, height: 10, backgroundColor: '#F1F5F9', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 999 },
  pct: { fontSize: 11, fontWeight: '700', color: theme.colors.muted, width: 32, textAlign: 'right' },
  count: { fontSize: 11, fontWeight: '800', color: theme.colors.text, width: 22, textAlign: 'right' },
  footer: { fontSize: 10, color: theme.colors.mutedSoft, marginTop: 4 },
});
