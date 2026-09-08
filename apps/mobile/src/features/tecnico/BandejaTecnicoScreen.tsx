// RF-12 — Módulo Técnico: bandeja asignada prioridad→antigüedad (Stitch #0E87E2 / #FD7C06)
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ESTADOS, PRIORIDADES, listAssignedTickets, type EstadoTicket, type PrioridadTicket, type Ticket } from '@helpdesk/shared';
import { Badge, Card, Divider, theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TecnicoStackParamList } from '../../navigation/types';

const PAGE_SIZE = 20;

type Props = { navigation: NativeStackNavigationProp<TecnicoStackParamList, 'Bandeja'> };

const tonoEstado = (e: string) => {
  if (e === 'abierto') return 'muted' as const;
  if (e === 'en_proceso' || e === 'programado') return 'info' as const;
  if (e === 'solucionado') return 'success' as const;
  if (e === 'cerrado') return 'ink' as const;
  if (e === 'devuelto') return 'danger' as const;
  return 'muted' as const;
};
const tonoPrioridad = (p: string) => {
  if (p === 'critica') return 'accent' as const;
  if (p === 'alta') return 'danger' as const;
  if (p === 'media') return 'warning' as const;
  return 'muted' as const;
};
const prettyEstado = (e: string) => e.replace('_', ' ');

// helper tiempo relativo corto
function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'hace minutos';
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hace 1 día';
  return `hace ${days}d`;
}

export function BandejaTecnicoScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [estado, setEstado] = useState<EstadoTicket | ''>('');
  const [prioridad, setPrioridad] = useState<PrioridadTicket | ''>('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => { if (ref.current) clearTimeout(ref.current); };
  }, [q]);

  const fetchPage = useCallback(async (targetPage: number, opts: { reset?: boolean } = {}) => {
    const isFirst = targetPage === 0;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await listAssignedTickets(supabase, {
        estado: estado || undefined,
        prioridad: prioridad || undefined,
        q: qDebounced || undefined,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      setTotal(res.total);
      setHasMore(res.hasMore);
      setPage(targetPage);
      setTickets((prev) => (opts.reset || isFirst ? res.data : [...prev, ...res.data]));
    } catch (e) {
      console.warn('[BandejaTecnico] listAssignedTickets', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [estado, prioridad, qDebounced]);

  useEffect(() => { fetchPage(0, { reset: true }); }, [fetchPage]);

  useEffect(() => {
    const ch = supabase.channel('bandeja-tecnico').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchPage(0, { reset: true })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPage]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchPage(0, { reset: true }); }, [fetchPage]);
  const onEndReached = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchPage(page + 1);
  }, [loadingMore, loading, hasMore, page, fetchPage]);

  const clearFilters = () => { setEstado(''); setPrioridad(''); setQ(''); };

  const hasActiveFilters = !!estado || !!prioridad || !!qDebounced;

  const renderItem = ({ item }: { item: Ticket }) => {
    const slaCritico = item.prioridad === 'critica' && item.estado !== 'cerrado' && item.estado !== 'solucionado';
    return (
      <Pressable
        onPress={() => navigation.navigate('DetalleTicket', { id: item.id })}
        style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.96 }]}
        accessibilityRole="button"
        accessibilityLabel={`Ticket #${item.numero} ${item.asunto}`}
      >
        <Card style={s.card}>
          <View style={s.cardTop}>
            <View style={s.codePill}><Text style={s.codeText}>#{String(item.numero).padStart(4, '0')}</Text></View>
            <View style={s.badges}>
              <Badge label={item.prioridad} tone={tonoPrioridad(item.prioridad)} />
              <Badge label={prettyEstado(item.estado)} tone={tonoEstado(item.estado)} />
            </View>
          </View>
          <Text style={s.asunto} numberOfLines={2}>{item.asunto}</Text>
          <Text style={s.desc} numberOfLines={2}>{item.descripcion}</Text>
          <Divider />
          <View style={s.metaRow}>
            <Text style={s.meta}>Mesa {item.mesaId ?? '—'} · {relativeTime(item.creadoEn)}</Text>
            {slaCritico ? <View style={s.slaDot}><View style={s.slaPulse} /><Text style={s.slaText}>SLA riesgo</Text></View> : null}
          </View>
          {item.fechaResolucion ? <Text style={s.metaSoft}>Resuelto {new Date(item.fechaResolucion).toLocaleDateString('es-ES')}</Text> : null}
        </Card>
      </Pressable>
    );
  };

  if (loading && tickets.length === 0) {
    return <View style={s.center}><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando bandeja…</Text></View>;
  }

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.kickerRow}><View style={s.kickerDot} /><Text style={s.kicker}>Técnico · Solo asignados a mí</Text></View>
        <Text style={s.h1}>Bandeja asignada</Text>
        <Text style={s.subtitle}>Ordenada por prioridad (crítica → baja) y antigüedad. Realtime activo.</Text>
      </View>

      {/* Filter Card — Stitch Card p16 */}
      <View style={s.filterCard}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar en asunto…"
            placeholderTextColor={theme.colors.mutedSoft}
            style={s.search}
            returnKeyType="search"
            accessibilityLabel="Buscar bandeja técnico"
          />
          {!!q && <Pressable onPress={() => setQ('')} style={s.clearBtn} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda"><Text style={s.clearText}>×</Text></Pressable>}
        </View>
        <View style={s.chipsBlock}>
          <Text style={s.chipsLabel}>Estado</Text>
          <View style={s.chipsRow}>
            {(['' as const, ...ESTADOS] as const).map((e) => (
              <Pressable key={String(e)} onPress={() => setEstado(e as EstadoTicket | '')} style={[s.chip, estado === e && s.chipActive]} accessibilityRole="button" accessibilityState={{ selected: estado === e }}>
                <Text style={[s.chipText, estado === e && s.chipTextActive]}>{e ? prettyEstado(e) : 'Todos'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={s.chipsBlock}>
          <Text style={s.chipsLabel}>Prioridad</Text>
          <View style={s.chipsRow}>
            {(['' as const, ...PRIORIDADES] as const).map((p) => (
              <Pressable key={String(p)} onPress={() => setPrioridad(p as PrioridadTicket | '')} style={[s.chip, prioridad === p && s.chipActive]} accessibilityRole="button" accessibilityState={{ selected: prioridad === p }}>
                <Text style={[s.chipText, prioridad === p && s.chipTextActive]}>{p || 'Todas'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={s.filterFooter}>
          <Text style={s.filterCount}>{total} resultados{hasActiveFilters ? ' · filtrado' : ''}</Text>
          {hasActiveFilters ? <Pressable onPress={clearFilters} style={s.linkBtn}><Text style={s.linkText}>Limpiar filtros</Text></Pressable> : null}
        </View>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        numColumns={isWide ? 2 : 1}
        key={isWide ? 'grid-2' : 'list-1'}
        columnWrapperStyle={isWide ? { gap: 12 } : undefined}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Sin tickets asignados</Text>
            <Text style={s.mutedCenter}>No tienes incidencias asignadas. Cuando el jefe te asigne un ticket aparecerá aquí.</Text>
            {hasActiveFilters ? <Pressable onPress={clearFilters} style={s.emptyBtn}><Text style={s.emptyBtnText}>Limpiar filtros</Text></Pressable> : null}
          </View>
        }
        ListFooterComponent={loadingMore ? <View style={s.footer}><ActivityIndicator color={theme.colors.primary} /></View> : null}
        contentContainerStyle={s.listContent}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.bg, padding: 24 },
  muted: { color: theme.colors.muted, fontSize: 12 },
  mutedCenter: { color: theme.colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 16 },
  header: { paddingHorizontal: theme.space[4], paddingTop: theme.space[4], paddingBottom: theme.space[3], gap: theme.space[2] - 2 }, // 16/16/12/6 — tokens
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }, // 8

  kickerDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.primary },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: theme.colors.muted, textTransform: 'uppercase' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  filterCard: {
    marginHorizontal: theme.space[3], // 12
    marginBottom: theme.space[3],
    gap: theme.space[3], // 12
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, // 20 — token lg
    padding: theme.space[4], // 16 — token space-4
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.soft,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.sm, // 10 — token sm (antes 12)
    paddingHorizontal: theme.space[3], // 12
    height: 44, // alinea con Button 44
  },
  searchIcon: { color: theme.colors.mutedSoft, marginRight: 8, fontSize: 14 },
  search: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  clearBtn: { padding: 6, marginLeft: 6 },
  clearText: { fontSize: 18, color: theme.colors.muted, fontWeight: '600' },
  chipsBlock: { gap: 6 },
  chipsLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.mutedSoft },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] - 2 }, // 6
  chip: {
    paddingHorizontal: theme.space[4] - 2, // 14
    paddingVertical: theme.space[2] - 2, // 6
    height: 32,
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  chipTextActive: { color: theme.colors.primaryDark, fontWeight: '700' },
  filterFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: theme.space[2], borderTopWidth: 1, borderTopColor: theme.colors.border },
  filterCount: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  linkBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  linkText: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  listContent: { padding: theme.space[3], gap: theme.space[3] - 2, paddingBottom: theme.space[6] }, // 12/10/24 — tokens
  cardPress: { flex: 1, borderRadius: theme.radius.lg }, // 20 — token lg (antes 16)
  card: { gap: theme.space[2], flex: 1 }, // 8
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codePill: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: theme.space[2], paddingVertical: theme.space[1], borderRadius: theme.space[2] }, // 8/4/8

  codeText: { fontSize: 11, fontWeight: '800', color: theme.colors.muted, fontFamily: theme.font.mono },
  badges: { flexDirection: 'row', gap: 6 },
  asunto: { fontSize: 14, fontWeight: '800', color: theme.colors.text, lineHeight: 18 },
  desc: { fontSize: 12, color: theme.colors.textSoft, lineHeight: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  metaSoft: { fontSize: 11, color: theme.colors.mutedSoft },
  slaDot: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  slaPulse: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.danger },
  slaText: { fontSize: 10, fontWeight: '800', color: '#991B1B', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', padding: theme.space[8], gap: theme.space[3] - 2, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginTop: theme.space[2] },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  emptyBtn: { marginTop: theme.space[2], backgroundColor: theme.colors.primary, paddingHorizontal: theme.space[4], paddingVertical: theme.space[3] - 2, borderRadius: theme.radius.sm },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  footer: { padding: 16, alignItems: 'center' },
});
