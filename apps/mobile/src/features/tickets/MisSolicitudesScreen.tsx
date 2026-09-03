// RF-08 — Mis solicitudes: server paginado + Realtime + pull-to-refresh (Performance + Tiempo real)
// Pulido IUE elegante: paper warm, cards con sombra soft, filtros brass refinados

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { ESTADOS, PRIORIDADES, listMyTickets, type EstadoTicket, type PrioridadTicket, type Ticket } from '@helpdesk/shared';
import { Badge, Card, Divider } from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EmpleadoStackParamList } from '../../navigation/types';

const PAGE_SIZE = 20;

type Props = { navigation: NativeStackNavigationProp<EmpleadoStackParamList, 'MisSolicitudes'> };

export function MisSolicitudesScreen({ navigation }: Props) {
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const fetchPage = useCallback(async (targetPage: number, opts: { reset?: boolean } = {}) => {
    const isFirst = targetPage === 0;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await listMyTickets(supabase, {
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
      console.warn('[MisSolicitudes] listMyTickets', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [estado, prioridad, qDebounced]);

  useEffect(() => { fetchPage(0, { reset: true }); }, [fetchPage]);

  useEffect(() => {
    const channel = supabase
      .channel('mis-solicitudes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchPage(0, { reset: true }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPage]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchPage(0, { reset: true }); }, [fetchPage]);
  const onEndReached = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchPage(page + 1);
  }, [loadingMore, loading, hasMore, page, fetchPage]);

  const renderItem = ({ item }: { item: Ticket }) => (
    <Pressable
      onPress={() => navigation.navigate('DetalleTicket', { id: item.id })}
      style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.96, transform: [{ scale: 0.99 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`Ticket ${item.numero} ${item.asunto}`}>
      <Card style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.numero}>#{String(item.numero).padStart(4, '0')}</Text>
          <View style={s.badges}>
            <Badge label={item.prioridad} tone={prioridadTone(item.prioridad)} />
            <Badge label={prettyEstado(item.estado)} tone={estadoTone(item.estado)} />
          </View>
        </View>
        <Text style={s.asunto} numberOfLines={2}>{item.asunto}</Text>
        <Text style={s.desc} numberOfLines={2}>{item.descripcion}</Text>
        <Divider />
        <Text style={s.meta}>{new Date(item.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} · #{item.numero}</Text>
      </Card>
    </Pressable>
  );

  const filterChips = (
    <View style={s.header}>
      <Text style={s.kicker}>Bandeja</Text>
      <Text style={s.h1}>Mis solicitudes</Text>
      <Text style={s.subtle}>Filtra por estado y prioridad. Pull para actualizar.</Text>

      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar en asunto…"
          placeholderTextColor={theme.colors.mutedSoft}
          style={s.search}
          returnKeyType="search"
          accessibilityLabel="Buscar solicitudes"
        />
        {!!q && (
          <Pressable onPress={() => setQ('')} style={s.clearBtn} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
            <Text style={s.clearText}>×</Text>
          </Pressable>
        )}
      </View>

      <Text style={s.filterLabel}>Estado</Text>
      <View style={s.chips}>
        <Chip label="Todos" active={!estado} onPress={() => setEstado('')} />
        {ESTADOS.map((e) => <Chip key={e} label={prettyEstado(e)} active={estado === e} onPress={() => setEstado(e as EstadoTicket)} />)}
      </View>

      <Text style={s.filterLabel}>Prioridad</Text>
      <View style={s.chips}>
        <Chip label="Todas" active={!prioridad} onPress={() => setPrioridad('')} />
        {PRIORIDADES.map((p) => <Chip key={p} label={p} active={prioridad === p} onPress={() => setPrioridad(p as PrioridadTicket)} />)}
      </View>

      <View style={s.totalRow}>
        <View style={s.totalDot} />
        <Text style={s.total}>{total} resultado{total !== 1 ? 's' : ''}</Text>
        {(!!estado || !!prioridad || !!qDebounced) && (
          <Pressable onPress={() => { setEstado(''); setPrioridad(''); setQ(''); }} style={s.resetBtn}>
            <Text style={s.resetText}>Limpiar filtros</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={s.center}>
        <View style={s.loadingCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={s.muted}>Cargando solicitudes…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={tickets}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        ListHeaderComponent={filterChips}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Sin solicitudes</Text>
            <Text style={s.emptySub}>Aún no has creado tickets. Crea tu primer solicitud y aparecerá aquí.</Text>
            <Pressable onPress={() => navigation.navigate('CrearTicket')} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Crear solicitud</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <View style={{ padding: 16 }}><ActivityIndicator color={theme.colors.muted} /></View>
          : hasMore ? <Text style={s.footerHint}>Desliza para cargar más</Text>
          : tickets.length ? <Text style={s.footerHint}>Fin de la lista</Text> : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && s.chipActive]}
      accessibilityRole="button"
      accessibilityLabel={`Filtro ${label}`}
      accessibilityState={{ selected: active }}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function prioridadTone(p: string): 'success' | 'warning' | 'danger' | 'accent' {
  if (p === 'critica') return 'danger';
  if (p === 'alta') return 'warning';
  if (p === 'media') return 'accent';
  return 'success';
}
function estadoTone(e: string): 'muted' | 'accent' | 'success' | 'ink' {
  if (e === 'abierto') return 'muted';
  if (e === 'en_proceso') return 'accent';
  if (e === 'solucionado') return 'success';
  if (e === 'cerrado') return 'ink';
  return 'muted';
}
function prettyEstado(e: string) { return e.replace('_', ' '); }

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg },
  loadingCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 10, ...theme.shadow.soft as object },
  muted: { color: theme.colors.muted, fontSize: 12, textAlign: 'center' },
  header: { gap: 10, marginBottom: 6 },
  kicker: { fontSize: 10, letterSpacing: 1.6, color: theme.colors.mutedSoft, fontWeight: '700', textTransform: 'uppercase' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.4, marginTop: -4 },
  subtle: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingHorizontal: 12, gap: 8, ...theme.shadow.soft as object },
  searchIcon: { color: theme.colors.mutedSoft, fontSize: 14, transform: [{ translateY: -1 }] },
  search: { flex: 1, paddingVertical: 12, fontSize: 13, color: theme.colors.text },
  clearBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  clearText: { color: theme.colors.muted, fontSize: 14, fontWeight: '700', marginTop: -1 },
  filterLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.mutedSoft, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 11, color: theme.colors.textSoft, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  totalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
  total: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  resetBtn: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  resetText: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  cardPress: { },
  card: { gap: 10, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numero: { fontSize: 12, fontWeight: '800', color: theme.colors.muted, letterSpacing: 0.6 },
  badges: { flexDirection: 'row', gap: 6 },
  asunto: { fontSize: 14, fontWeight: '800', color: theme.colors.text, lineHeight: 19, letterSpacing: -0.2 },
  desc: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  meta: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '600', letterSpacing: 0.3 },
  empty: { alignItems: 'center', gap: 8, padding: 18, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft as object },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  emptySub: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', lineHeight: 17 },
  primaryBtn: { marginTop: 6, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 11, borderRadius: theme.radius.full },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  footerHint: { color: theme.colors.mutedSoft, fontSize: 11, textAlign: 'center', padding: 14, fontWeight: '600' },
});
