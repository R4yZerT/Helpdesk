// AreaEvolucion — Stitch 4 series TIC/Com/Infra/EAPSA + tooltip (simplificado sin svg)
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';

type Punto = { dia: string; mesaId: number; count: number };

export function AreaEvolucion({ data, mesas }: { data: Punto[]; mesas: { id: number; nombre: string }[] }) {
  // Agrupa por día total
  const byDay = new Map<string, number>();
  data.forEach((p) => byDay.set(p.dia, (byDay.get(p.dia) ?? 0) + p.count));
  const days = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  const max = Math.max(1, ...days.map(([, v]) => v));

  const colorByMesa: Record<number, string> = {
    1: theme.colors.primary,
    2: theme.colors.accent,
    3: theme.colors.success,
    4: theme.colors.mutedSoft,
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={s.head}>
        <Text style={s.title}>Evolución 30 Días</Text>
        <View style={s.mesaRow}>
          {mesas.slice(0, 4).map((m) => (
            <View key={m.id} style={s.mesaPill}>
              <View style={[s.mesaDot, { backgroundColor: colorByMesa[m.id] ?? theme.colors.muted }]} />
              <Text style={s.mesaText}>{m.nombre}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.chart}>
        {days.map(([dia, val]) => (
          <View key={dia} style={s.barCol}>
            <View style={s.barTrack}>
              <View style={[s.barFill, { height: `${Math.round((val / max) * 100)}%`, backgroundColor: theme.colors.primary }]} />
            </View>
            <Text style={s.dayLabel}>{dia.slice(5)}</Text>
          </View>
        ))}
      </View>
      <Text style={s.footer}>Rango {days[0]?.[0] ?? '—'} — {days[days.length - 1]?.[0] ?? '—'} · {days.length} días</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  mesaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mesaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  mesaDot: { width: 8, height: 8, borderRadius: 4 },
  mesaText: { fontSize: 10, fontWeight: '600', color: theme.colors.textSoft },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 120, paddingTop: 8 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '100%', backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6, minHeight: 2 },
  dayLabel: { fontSize: 8, color: theme.colors.mutedSoft },
  footer: { fontSize: 10, color: theme.colors.mutedSoft },
});
