// FilterBar — RF-17 filtros combinables: rango/dependencia/tecnico/categoria/prioridad/estado
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme.js';
import { FilterDropdown } from '../FilterDropdown.js';
import { ESTADO_OPTIONS, PRIORIDAD_OPTIONS } from '../../filters.js';

export type FilterRange = 'hoy' | '7d' | '30d' | 'custom';

export function FilterBar({
  range,
  onRangeChange,
  mesaIds,
  onToggleMesa,
  mesas,
  onExport,
  estado,
  onEstadoChange,
  prioridad,
  onPrioridadChange,
  categoriaId,
  onCategoriaChange,
  categorias,
  tecnicoId,
  onTecnicoChange,
  tecnicos,
  customDesde,
  customHasta,
  onCustomDesdeChange,
  onCustomHastaChange,
}: {
  range: FilterRange;
  onRangeChange: (r: FilterRange) => void;
  mesaIds: number[];
  onToggleMesa: (id: number) => void;
  mesas: { id: number; nombre: string }[];
  onExport?: () => void;
  estado?: string;
  onEstadoChange?: (v: string) => void;
  prioridad?: string;
  onPrioridadChange?: (v: string) => void;
  categoriaId?: number | '';
  onCategoriaChange?: (v: number | '') => void;
  categorias?: { id: number; nombre: string }[];
  tecnicoId?: string;
  onTecnicoChange?: (v: string) => void;
  tecnicos?: { id: string; nombre: string }[];
  customDesde?: string;
  customHasta?: string;
  onCustomDesdeChange?: (v: string) => void;
  onCustomHastaChange?: (v: string) => void;
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
      {(onEstadoChange || onPrioridadChange || onCategoriaChange || onTecnicoChange) ? (
        <View style={s.secondRow}>
          {onEstadoChange ? (
            <FilterDropdown label="Estado" value={estado ?? ''} onSelect={(v) => onEstadoChange(String(v))} options={ESTADO_OPTIONS as any} />
          ) : null}
          {onPrioridadChange ? (
            <FilterDropdown label="Prioridad" value={prioridad ?? ''} onSelect={(v) => onPrioridadChange(String(v))} options={PRIORIDAD_OPTIONS as any} />
          ) : null}
          {onCategoriaChange && categorias ? (
            <FilterDropdown
              label="Categoría"
              value={categoriaId ?? ''}
              onSelect={(v) => onCategoriaChange(v as number | '')}
              options={[{ value: '', label: 'Todas' }, ...categorias.map((c) => ({ value: c.id, label: c.nombre }))]}
            />
          ) : null}
          {onTecnicoChange && tecnicos ? (
            <FilterDropdown
              label="Técnico"
              value={tecnicoId ?? ''}
              onSelect={(v) => onTecnicoChange(String(v))}
              options={[{ value: '', label: 'Todos' }, ...tecnicos.map((t) => ({ value: t.id, label: t.nombre }))]}
            />
          ) : null}
        </View>
      ) : null}
      {range === 'custom' && onCustomDesdeChange && onCustomHastaChange ? (
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Desde</Text>
          <TextInput value={customDesde ?? ''} onChangeText={onCustomDesdeChange} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.muted} style={s.dateInput} />
          <Text style={s.dateLabel}>Hasta</Text>
          <TextInput value={customHasta ?? ''} onChangeText={onCustomHastaChange} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.muted} style={s.dateInput} />
        </View>
      ) : null}
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
  secondRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dateLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },
  dateInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, minWidth: 110, backgroundColor: theme.colors.surface },
});
