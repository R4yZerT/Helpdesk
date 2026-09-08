// DonutEstado — 5 estados con dona segmentada (conic-gradient) + leyenda barras
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';

const ESTADOS_ORDEN: readonly string[] = ['abierto', 'en_proceso', 'solucionado', 'cerrado', 'devuelto'] as const;
const COLORS: Record<string, string> = {
  abierto: theme.colors.primary,      // azul
  en_proceso: theme.colors.warning,   // ámbar
  solucionado: theme.colors.success,  // verde
  cerrado: theme.colors.text,         // navy
  devuelto: theme.colors.danger,      // rojo
};

export function DonutEstado({ data }: { data: { estado: string; count: number }[] }) {
  const byEstado = new Map(data.map((d) => [d.estado, d.count]));
  if (byEstado.has('programado')) {
    byEstado.set('en_proceso', (byEstado.get('en_proceso') ?? 0) + (byEstado.get('programado') ?? 0));
    byEstado.delete('programado');
  }
  const filled = ESTADOS_ORDEN.map((e) => ({ estado: e, count: byEstado.get(e) ?? 0 }));
  const total = filled.reduce((a, b) => a + b.count, 0) || 1;

  // conic-gradient para web: calcula stops acumulados
  let acc = 0;
  const stops: string[] = [];
  for (const d of filled) {
    const pct = (d.count / total) * 100;
    if (pct <= 0) continue;
    const color = COLORS[d.estado] ?? theme.colors.muted;
    const start = acc;
    const end = acc + pct;
    stops.push(`${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
    acc = end;
  }
  const gradient = stops.length ? `conic-gradient(${stops.join(', ')})` : `conic-gradient(${theme.colors.border} 0% 100%)`;

  return (
    <Card style={{ gap: 12 }}>
      <View style={s.header}>
        <Text style={s.title}>Distribución por Estado</Text>
        <Text style={s.subtitle}>{total} tickets · 5 estados</Text>
      </View>
      <View style={s.donutRow}>
        <View style={[s.donutOuter, { backgroundImage: gradient } as any]}>
          <View style={s.donutInner}>
            <Text style={s.centerNum}>{total}</Text>
            <Text style={s.centerLabel}>total</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {filled.map((d) => {
            const pct = Math.round((d.count / total) * 100);
            return (
              <View key={d.estado} style={s.legendRow}>
                <View style={[s.dot, { backgroundColor: COLORS[d.estado] ?? theme.colors.muted }]} />
                <Text style={s.legendLabel}>{d.estado.replace('_', ' ')}</Text>
                <Text style={s.legendCount}>{d.count}</Text>
                <Text style={s.legendPct}>{pct}%</Text>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${pct}%`, backgroundColor: COLORS[d.estado] ?? theme.colors.muted }]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <Text style={s.help}>Estado = fase del flujo (abierto→en proceso→solucionado/cerrado). Prioridad = urgencia en panel vecino.</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  subtitle: { fontSize: 10, fontWeight: '600', color: theme.colors.muted },
  donutRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  donutOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    overflow: 'hidden',
  } as any,
  donutInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  centerNum: { fontSize: 18, fontWeight: '800', color: theme.colors.text, lineHeight: 18 },
  centerLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.muted },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.textSoft, textTransform: 'capitalize', flex: 1 },
  legendCount: { fontSize: 11, fontWeight: '800', color: theme.colors.text, minWidth: 20, textAlign: 'right' },
  legendPct: { fontSize: 10, fontWeight: '700', color: theme.colors.muted, minWidth: 30, textAlign: 'right' },
  barBg: { width: 56, height: 6, backgroundColor: theme.colors.surfaceAlt, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
  help: { fontSize: 10, color: theme.colors.mutedSoft, lineHeight: 14 },
});
