// RF-08 — Filtros de Mis Solicitudes (reutilizable)
import { StyleSheet } from 'react-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Card, FilterDropdown, ESTADO_OPTIONS, PRIORIDAD_OPTIONS, theme, type EstadoTicket, type PrioridadTicket } from '@helpdesk/shared';

type Props = {
  q: string;
  setQ: (v: string) => void;
  estado: string;
  setEstado: (v: EstadoTicket | '') => void;
  prioridad: string;
  setPrioridad: (v: PrioridadTicket | '') => void;
  total: number;
  activos: number;
  qDebounced: string;
  onReset: () => void;
};

export function TicketFilters({ q, setQ, estado, setEstado, prioridad, setPrioridad, total, activos, qDebounced, onReset }: Props) {
  return (
    <View style={s.header}>
      <Card style={s.filterCard}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar por ticket (#, asunto)" placeholderTextColor={theme.colors.mutedSoft} style={s.search} returnKeyType="search" accessibilityLabel="Buscar solicitudes" />
          {!!q && (
            <Pressable onPress={() => setQ('')} style={s.clearBtn} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
              <Text style={s.clearText}>×</Text>
            </Pressable>
          )}
        </View>
        <View style={s.dropdownRow}>
          <FilterDropdown label="Estado" value={estado as never} options={ESTADO_OPTIONS as never} onSelect={(v) => setEstado((v as string) as EstadoTicket | '')} placeholder="Todos" />
          <FilterDropdown label="Prioridad" value={prioridad as never} options={PRIORIDAD_OPTIONS as never} onSelect={(v) => setPrioridad((v as string) as PrioridadTicket | '')} placeholder="Todas" />
        </View>
        <View style={s.totalRow}>
          <View style={s.totalDot} />
          <Text style={s.total}>{total} resultado{total !== 1 ? 's' : ''} · {qDebounced ? `"${qDebounced}"` : 'sin búsqueda'}</Text>
          <View style={s.countersInline}>
            <View style={[s.counter, s.counterActive]}><View style={s.dot} /><Text style={s.counterText}>{activos} activos</Text></View>
            <Text style={s.counterMuted}>{total} total</Text>
          </View>
          {(!!estado || !!prioridad || !!qDebounced) ? (
            <Pressable onPress={onReset} style={s.resetBtn}><Text style={s.resetText}>Limpiar filtros</Text></Pressable>
          ) : null}
        </View>
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  header: { marginBottom: 4 },
  filterCard: { gap: 10, padding: 16, borderRadius: theme.radius.lg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: 12, paddingHorizontal: 12, gap: 8, height: 44 },
  searchIcon: { color: theme.colors.mutedSoft, fontSize: 14 },
  search: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  clearBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  clearText: { color: theme.colors.muted, fontSize: 16, fontWeight: '700', marginTop: -1 },
  dropdownRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  totalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  total: { fontSize: 11, color: theme.colors.muted, fontWeight: '600', flex: 1 },
  countersInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  counterActive: { backgroundColor: theme.colors.primarySoft, borderColor: '#BFDBFE' },
  counterText: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark },
  counterMuted: { fontSize: 11, color: theme.colors.mutedSoft, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  resetBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  resetText: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
});