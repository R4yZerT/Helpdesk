// DonutEstado — 5 estados con dona segmentada (react-native-svg, web+nativo) + leyenda
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, G, Svg } from 'react-native-svg';
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

// Geometría del anillo: exterior 96, interior 62 → trazo 17, radio medio 39.5
const SIZE = 96;
const STROKE = 17;
const RADIO = (SIZE - STROKE) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export function DonutEstado({ data }: { data: { estado: string; count: number }[] }) {
  const byEstado = new Map(data.map((d) => [d.estado, d.count]));
  if (byEstado.has('programado')) {
    byEstado.set('en_proceso', (byEstado.get('en_proceso') ?? 0) + (byEstado.get('programado') ?? 0));
    byEstado.delete('programado');
  }
  const filled = ESTADOS_ORDEN.map((e) => ({ estado: e, count: byEstado.get(e) ?? 0 }));
  const total = filled.reduce((a, b) => a + b.count, 0);

  // Segmentos acumulados: cada Circle dibuja su fracción con dashoffset
  let acc = 0;
  const segmentos: { estado: string; color: string; dash: string; offset: number }[] = [];
  for (const d of filled) {
    const frac = total > 0 ? d.count / total : 0;
    if (frac <= 0) continue;
    const color = COLORS[d.estado] ?? theme.colors.muted;
    const len = frac * CIRCUNFERENCIA;
    segmentos.push({
      estado: d.estado,
      color,
      dash: `${len.toFixed(2)} ${(CIRCUNFERENCIA - len).toFixed(2)}`,
      offset: -acc * CIRCUNFERENCIA,
    });
    acc += frac;
  }

  // Resumen textual para lector de pantalla (los charts no exponen nodos)
  const resumen = total > 0
    ? `Distribución por estado: ${filled.map((d) => `${d.estado.replace('_', ' ')} ${d.count}`).join(', ')}. Total ${total} tickets.`
    : 'Sin tickets para mostrar distribución por estado.';

  return (
    <Card style={{ gap: 12 }}>
      <View style={s.header}>
        <Text style={s.title}>Distribución por Estado</Text>
        <Text style={s.subtitle}>{total} tickets · 5 estados</Text>
      </View>
      <View style={s.donutRow}>
        <View style={s.donutOuter} accessible accessibilityRole="image" accessibilityLabel={resumen}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <G rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`}>
              {segmentos.length === 0 ? (
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIO}
                  fill="none"
                  stroke={theme.colors.border}
                  strokeWidth={STROKE}
                />
              ) : (
                segmentos.map((sg) => (
                  <Circle
                    key={sg.estado}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIO}
                    fill="none"
                    stroke={sg.color}
                    strokeWidth={STROKE}
                    strokeDasharray={sg.dash}
                    strokeDashoffset={sg.offset}
                  />
                ))
              )}
            </G>
          </Svg>
          <View style={s.donutInner}>
            <Text style={s.centerNum}>{total}</Text>
            <Text style={s.centerLabel}>total</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {filled.map((d) => {
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
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
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  donutInner: {
    position: 'absolute',
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
