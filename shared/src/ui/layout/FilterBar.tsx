// FilterBar — RF-17 filtros combinables: rango/dependencia/tecnico/categoria/prioridad/estado
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { getMesaIdPorDominio } from '../../ia.js';
import { FilterDropdown } from '../FilterDropdown.js';
import { ESTADO_OPTIONS, PRIORIDAD_OPTIONS } from '../../filters.js';

// Selector de fecha por dropdowns día/mes/año (todos los filtros van por dropdown).
// Compone 'YYYY-MM-DD'; si falta alguna parte emite '' (sin filtro).
const MESES = [
  { value: '01', label: 'Ene' }, { value: '02', label: 'Feb' }, { value: '03', label: 'Mar' },
  { value: '04', label: 'Abr' }, { value: '05', label: 'May' }, { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' }, { value: '08', label: 'Ago' }, { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dic' },
];
const DIAS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1).padStart(2, '0') }));
const ANIOS = Array.from({ length: 7 }, (_, i) => ({ value: String(new Date().getFullYear() - i), label: String(new Date().getFullYear() - i) }));

function splitFecha(v?: string): { d: string; m: string; y: string } {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  return mt ? { y: mt[1], m: mt[2], d: mt[3] } : { d: '', m: '', y: '' };
}

function DatePickers({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const p = splitFecha(value);
  const set = (k: 'd' | 'm' | 'y', v: string) => {
    const next = { ...p, [k]: String(v) };
    onChange(next.d && next.m && next.y ? `${next.y}-${next.m}-${next.d}` : '');
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={s.dateLabel}>{label}</Text>
      <FilterDropdown label="Día" value={p.d as never} placeholder="DD" options={[{ value: '' as never, label: '—' }, ...DIAS as never[]]} onSelect={(v) => set('d', String(v))} />
      <FilterDropdown label="Mes" value={p.m as never} placeholder="MM" options={[{ value: '' as never, label: '—' }, ...MESES as never[]]} onSelect={(v) => set('m', String(v))} />
      <FilterDropdown label="Año" value={p.y as never} placeholder="AAAA" options={[{ value: '' as never, label: '—' }, ...ANIOS as never[]]} onSelect={(v) => set('y', String(v))} />
    </View>
  );
}

export type FilterRange = 'hoy' | '7d' | '30d' | 'custom';

export function FilterBar({
  range,
  onRangeChange,
  mesaIds,
  onToggleMesa,
  mesas,
  onExport,
  onExportPng,
  onExportPdf,
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
  onExportPng?: () => void;
  onExportPdf?: () => void;
  estado?: string;
  onEstadoChange?: (v: string) => void;
  prioridad?: string;
  onPrioridadChange?: (v: string) => void;
  categoriaId?: number | '';
  onCategoriaChange?: (v: number | '') => void;
  categorias?: { id: number; nombre: string; dominio: string }[];
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
        {mesas.length ? <View style={s.divider} /> : null}
        {mesas.length ? (
          <FilterDropdown
            label="Dependencia"
            value={(mesaIds[0] ?? '') as never}
            placeholder="Todas"
            options={[{ value: '' as never, label: 'Todas' }, ...mesas.map((m) => ({ value: m.id as never, label: m.nombre }))]}
            onSelect={(v) => {
              const id = v as unknown as number | '';
              if (id === '' || id == null) { mesaIds.slice().forEach((mid) => onToggleMesa(mid)); return; }
              else {
                // single-select dropdown: limpia y setea uno; si ya activo lo limpia
                if (mesaIds.includes(id as number)) onToggleMesa(id as number);
                else {
                  // limpia anteriores y activa solo este
                  mesaIds.slice().forEach((mid) => onToggleMesa(mid));
                  onToggleMesa(id as number);
                }
              }
            }}
          />
        ) : null}
        {onExport ? (
          <Pressable onPress={onExport} style={s.exportBtn}>
            <Text style={s.exportText}>Exportar CSV</Text>
          </Pressable>
        ) : null}
        {onExportPng ? (
          <Pressable onPress={onExportPng} style={[s.exportBtn, { backgroundColor: '#0F172A' }]}>
            <Text style={s.exportText}>PNG gráficas</Text>
          </Pressable>
        ) : null}
        {onExportPdf ? (
          <Pressable onPress={onExportPdf} style={[s.exportBtn, { backgroundColor: theme.colors.accent }]}>
            <Text style={s.exportText}>PDF gráficas</Text>
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
              disabled={mesaIds.length === 0}
              disabledPlaceholder="Elige dependencia primero"
              onSelect={(v) => onCategoriaChange(v as number | '')}
              options={[{ value: '', label: 'Todas' }, ...(mesaIds.length ? categorias.filter((c) => getMesaIdPorDominio(c.dominio) === mesaIds[0]) : categorias).map((c) => ({ value: c.id, label: c.nombre }))]}
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
          <DatePickers label="Desde" value={customDesde} onChange={onCustomDesdeChange} />
          <DatePickers label="Hasta" value={customHasta} onChange={onCustomHastaChange} />
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  dateLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },
});
