// FilterBar — Stitch sticky top-16: Hoy/7d/30d + Mesas + Categoría + Estado + Export
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';

export type FilterRange = 'hoy' | '7d' | '30d' | 'custom';

export function FilterBar({
  range,
  onRangeChange,
  mesaIds,
  onToggleMesa,
  mesas,
  onExport,
}: {
  range: FilterRange;
  onRangeChange: (r: FilterRange) => void;
  mesaIds: number[];
  onToggleMesa: (id: number) => void;
  mesas: { id: number; nombre: string }[];
  onExport?: () => void;
}) {
  const ranges: { id: FilterRange; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: 'custom', label: 'Personalizado' },
  ];
  return (
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        <View style={s.segment}>
          {ranges.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => onRangeChange(r.id)}
              style={[s.segItem, range === r.id && s.segActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: range === r.id }}
            >
              <Text style={[s.segText, range === r.id && s.segTextActive]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.divider} />
        {mesas.map((m) => {
          const active = mesaIds.includes(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => onToggleMesa(m.id)}
              style={[s.pill, active && s.pillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{m.nombre}</Text>
            </Pressable>
          );
        })}
        {onExport ? (
          <Pressable onPress={onExport} style={s.exportBtn}>
            <Text style={s.exportText}>Exportar CSV</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 10, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segment: { flexDirection: 'row', backgroundColor: theme.colors.surfaceAlt, borderRadius: 999, padding: 3, gap: 2 },
  segItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  segActive: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  segText: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },
  segTextActive: { color: theme.colors.text },
  divider: { width: 1, height: 18, backgroundColor: theme.colors.border, marginHorizontal: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  pillActive: { backgroundColor: theme.colors.primarySoft, borderColor: '#BFDBFE' },
  pillText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSoft },
  pillTextActive: { color: theme.colors.primaryDark },
  exportBtn: { marginLeft: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  exportText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
