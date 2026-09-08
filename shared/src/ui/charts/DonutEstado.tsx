// DonutEstado — Stitch r60 circ377 5 estados + legend (sin svg lib, barras como fallback accesible)
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';

const ESTADOS_ORDEN: readonly string[] = ['abierto', 'en_proceso', 'solucionado', 'cerrado', 'devuelto'] as const;
const COLORS: Record<string, string> = {
  abierto: theme.colors.primary,        // azul operativo
  en_proceso: theme.colors.warning,     // ámbar
  solucionado: theme.colors.success,    // verde
  cerrado: theme.colors.text,           // navy oscuro
  devuelto: theme.colors.danger,        // rojo
};

export function DonutEstado({ data }: { data: { estado: string; count: number }[] }) {
  // Normaliza para que la dona siempre muestre los 5 estados (0 si no hay datos) y cada color se vea
  // Legacy: si aún existen tickets 'programado' en BD, se suman a en_proceso para no perder conteo
  const byEstado = new Map(data.map((d) => [d.estado, d.count]));
  if (byEstado.has('programado')) {
    byEstado.set('en_proceso', (byEstado.get('en_proceso') ?? 0) + (byEstado.get('programado') ?? 0));
    byEstado.delete('programado');
  }
  const filled = ESTADOS_ORDEN.map((e) => ({ estado: e, count: byEstado.get(e) ?? 0 }));
  const total = filled.reduce((a, b) => a + b.count, 0) || 1;
  return (
    <Card style={{ gap: 12 }}>
      <Text style={s.title}>Distribución por Estado</Text>
      <View style={s.donutRow}>
        <View style={s.donut}>
          <Text style={s.centerNum}>{total}</Text>
          <Text style={s.centerLabel}>activos</Text>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          {filled.map((d) => (
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
