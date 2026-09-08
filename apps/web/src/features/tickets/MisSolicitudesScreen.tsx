// RF-08 — Mis solicitudes: server paginado + Realtime + pull-to-refresh (Stitch: grid 2cols, FAB naranja)
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { fetchMesas, listMyTickets, type EstadoTicket, type PrioridadTicket, type Ticket, type Mesa } from '@helpdesk/shared';
import { Badge, Card, Divider } from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { FilterDropdown, ESTADO_OPTIONS, PRIORIDAD_OPTIONS } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EmpleadoStackParamList } from '../../navigation/types';

const PAGE_SIZE = 20;

type Props = { navigation: NativeStackNavigationProp<EmpleadoStackParamList, 'MisSolicitudes'> };

export function MisSolicitudesScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
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

  useEffect(() => { fetchMesas(supabase).then(setMesas).catch(() => {}); }, []);

  const mesaName = useCallback((id: number | null) => mesas.find((m) => m.id === id)?.nombre ?? (id ? `Mesa ${id}` : '—'), [mesas]);

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

  const activos = tickets.filter((t) => t.estado !== 'cerrado' && t.estado !== 'solucionado').length;

  const renderItem = ({ item }: { item: Ticket }) => (
    <Pressable
      onPress={() => navigation.navigate('DetalleTicket', { id: item.id })}
      style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.96, transform: [{ scale: 0.992 }] }]}
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
        <View style={s.metaRow}>
          <Text style={s.meta}>{mesaName(item.mesaId)} · {relativeTime(item.creadoEn)}</Text>
          {item.tecnicoAsignadoId ? <Text style={s.metaStrong}>Técnico asignado</Text> : null}
        </View>
      </Card>
    </Pressable>
  );

  const filterCard = (
    <View style={s.header}>
      <View style={s.titleRow}>
        <View>
          <Text style={s.kicker}>Bandeja</Text>
          <Text style={s.h1}>Mis solicitudes</Text>
          <Text style={s.subtle}>Filtra por estado y prioridad. Pull para actualizar.</Text>
        </View>
        <View style={s.counters}>
          <View style={[s.counter, s.counterActive]}><View style={s.dot} /><Text style={s.counterText}>{activos} activos</Text></View>
          <Text style={s.counterMuted}>{total} total</Text>
        </View>
      </View>

      <Card style={s.filterCard}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar por ticket (#, asunto)"
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

        <View style={s.dropdownRow}>
          <FilterDropdown label="Estado" value={estado as never} options={ESTADO_OPTIONS as never} onSelect={(v) => setEstado((v as string) as EstadoTicket | '')} placeholder="Todos" />
          <FilterDropdown label="Prioridad" value={prioridad as never} options={PRIORIDAD_OPTIONS as never} onSelect={(v) => setPrioridad((v as string) as PrioridadTicket | '')} placeholder="Todas" />
        </View>

        <View style={s.totalRow}>
          <View style={s.totalDot} />
          <Text style={s.total}>{total} resultado{total !== 1 ? 's' : ''} · {qDebounced ? `"${qDebounced}"` : 'sin búsqueda'}</Text>
          {(!!estado || !!prioridad || !!qDebounced) && (
            <Pressable onPress={() => { setEstado(''); setPrioridad(''); setQ(''); }} style={s.resetBtn}>
              <Text style={s.resetText}>Limpiar filtros</Text>
            </Pressable>
          )}
        </View>
      </Card>
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
        key={isWide ? 'grid-2' : 'grid-1'}
        numColumns={isWide ? 2 : 1}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        ListHeaderComponent={filterCard}
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
          <View style={{ gap: 12 }}>
            {loadingMore ? <View style={{ padding: 16 }}><ActivityIndicator color={theme.colors.muted} /></View>
            : hasMore ? <Text style={s.footerHint}>Desliza para cargar más</Text>
            : tickets.length ? <Text style={s.footerHint}>Fin de la lista</Text> : null}
            {tickets.length > 0 ? (
              <View style={s.banner}>
                <Text style={s.bannerText}>¿No encuentras lo que buscas?</Text>
                <Pressable onPress={() => { setEstado(''); setPrioridad(''); setQ(''); }} style={s.bannerBtn}>
                  <Text style={s.bannerBtnText}>Limpiar filtros y ver todo</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 88 }}
        columnWrapperStyle={isWide ? { gap: 12 } : undefined}
      />
      {/* FAB Stitch #FD7C06 */}
      <Pressable onPress={() => navigation.navigate('CrearTicket')} style={s.fab} accessibilityRole="button" accessibilityLabel="Crear nueva solicitud">
        <Text style={s.fabIcon}>＋</Text>
        <Text style={s.fabText}>Nuevo Ticket</Text>
      </Pressable>
    </View>
  );
}

function prioridadTone(p: string): 'success' | 'warning' | 'danger' | 'accent' | 'info' {
  if (p === 'critica') return 'accent';
  if (p === 'alta') return 'danger';
  if (p === 'media') return 'warning';
  return 'success';
}
function estadoTone(e: string): 'muted' | 'info' | 'success' | 'ink' | 'danger' {
  if (e === 'abierto') return 'muted';
  if (e === 'en_proceso' || e === 'programado') return 'info';
  if (e === 'solucionado') return 'success';
  if (e === 'cerrado') return 'ink';
  if (e === 'devuelto') return 'danger';
  return 'muted';
}
function prettyEstado(e: string) { return e.replace('_', ' '); }
function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'hace minutos';
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hace 1 día';
  if (days < 7) return `hace ${days} días`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg },
  loadingCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 10, ...theme.shadow.soft as object },
  muted: { color: theme.colors.muted, fontSize: 12, textAlign: 'center' },
  header: { gap: 12, marginBottom: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  kicker: { fontSize: 10, letterSpacing: 1.6, color: theme.colors.mutedSoft, fontWeight: '700', textTransform: 'uppercase' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4, marginTop: -4 },
  subtle: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  counters: { alignItems: 'flex-end', gap: 4, marginTop: 2 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  counterActive: { backgroundColor: theme.colors.primarySoft, borderColor: '#BFDBFE' },
  counterText: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark },
  counterMuted: { fontSize: 11, color: theme.colors.mutedSoft, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
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
  resetBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  resetText: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  cardPress: { flex: 1 },
  card: { gap: 10, padding: 16, flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numero: { fontSize: 12, fontWeight: '800', color: theme.colors.muted, letterSpacing: 0.6, fontFamily: theme.font.mono },
  badges: { flexDirection: 'row', gap: 6 },
  asunto: { fontSize: 14, fontWeight: '800', color: theme.colors.text, lineHeight: 19, letterSpacing: -0.2 },
  desc: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '600', letterSpacing: 0.3 },
  metaStrong: { fontSize: 10, color: theme.colors.textSoft, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, padding: 18, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft as object },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  emptySub: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', lineHeight: 17 },
  primaryBtn: { marginTop: 6, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 11, borderRadius: theme.radius.full },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  footerHint: { color: theme.colors.mutedSoft, fontSize: 11, textAlign: 'center', padding: 14, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surfaceAlt, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  bannerText: { fontSize: 12, color: theme.colors.muted, fontWeight: '600', flex: 1 },
  bannerBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  bannerBtnText: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  fab: { position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.accent, paddingHorizontal: 18, height: 48, borderRadius: 999, ...theme.shadow.medium as object, borderWidth: 1, borderColor: '#FED7AA' },
  fabIcon: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: -1 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
});
