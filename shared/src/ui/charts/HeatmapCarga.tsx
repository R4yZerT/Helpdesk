// HeatmapCarga — Stitch 5×15 Lun-Vie 07-21 escala Baja/Media/Alta/Pico
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';

type Cell = { dow: number; hour: number; count: number; nivel: 'baja' | 'media' | 'alta' | 'pico' };

const NIVEL_COLOR: Record<string, string> = {
  baja: '#EEF2F7',
  media: '#A0CAFF',
  alta: theme.colors.primary,
  pico: theme.colors.accent,
};

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const HOURS = Array.from({ length: 15 }, (_, i) => 7 + i);

export function HeatmapCarga({ data }: { data: Cell[] }) {
  const map = new Map(data.map((c) => [`${c.dow}-${c.hour}`, c.nivel]));
  return (
    <Card style={{ gap: 10 }}>
      <Text style={s.title}>Carga Horaria Lun–Vie 07:00–21:00</Text>
      <View style={s.legend}>
        {[
          ['Baja', '#EEF2F7'],
          ['Media', '#A0CAFF'],
          ['Alta', theme.colors.primary],
          ['Pico', theme.colors.accent],
        ].map(([l, c]) => (
          <View key={l} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: c }]} />
            <Text style={s.legendText}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={s.grid}>
        <View style={s.headerRow}>
          <Text style={s.corner}></Text>
          {HOURS.map((h) => (
            <Text key={h} style={s.hourLabel}>
              {String(h).padStart(2, '0')}
            </Text>
          ))}
        </View>
        {DAYS.map((day, dow) => (
          <View key={day} style={s.row}>
            <Text style={s.dayLabel}>{day}</Text>
            {HOURS.map((h) => {
              const nivel = map.get(`${dow}-${h}`) ?? 'baja';
              return <View key={h} style={[s.cell, { backgroundColor: NIVEL_COLOR[nivel] }]} />;
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  grid: { gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 32 },
  hourLabel: { fontSize: 8, color: theme.colors.mutedSoft, width: 14, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dayLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.muted, width: 28 },
  cell: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(226,232,240,0.6)' },
  corner: { width: 28 },
});
