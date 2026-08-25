// RF-08 — Mis solicitudes: server paginado + Realtime + pull-to-refresh (Performance + Tiempo real)
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { ESTADOS, PRIORIDADES, listMyTickets, type EstadoTicket, type PrioridadTicket, type Ticket } from '@helpdesk/shared';
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

  // Debounce búsqueda 350ms (evita queries por cada tecla)
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
      // No bloquea UI: deja lista previa + log
      console.warn('[MisSolicitudes] listMyTickets', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [estado, prioridad, qDebounced]);

  // Carga inicial + refetch al cambiar filtros (server paginado)
  useEffect(() => {
    fetchPage(0, { reset: true });
  }, [fetchPage]);

  // Realtime + pull: canal tickets cambios del usuario (insert/update)
  useEffect(() => {
    const channel = supabase
      .channel('mis-solicitudes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        // Pull suave: recarga primera página (no rompe paginación)
        fetchPage(0, { reset: true });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPage(0, { reset: true });
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchPage(page + 1);
  }, [loadingMore, loading, hasMore, page, fetchPage]);

  const renderItem = ({ item }: { item: Ticket }) => (
    <Pressable
      onPress={() => navigation.navigate('DetalleTicket', { id: item.id })}
      style={s.card}
      accessibilityRole="button"
      accessibilityLabel={`Ticket ${item.numero} ${item.asunto}`}>
      <View style={s.cardHeader}>
        <Text style={s.numero}>#{item.numero}</Text>
        <View style={[s.badge, prioridadColor(item.prioridad)]}><Text style={s.badgeText}>{item.prioridad}</Text></View>
        <View style={[s.badge, estadoColor(item.estado)]}><Text style={s.badgeText}>{item.estado}</Text></View>
      </View>
      <Text style={s.asunto} numberOfLines={2}>{item.asunto}</Text>
      <Text style={s.meta}>{new Date(item.creadoEn).toLocaleDateString('es-ES')} · {item.descripcion.slice(0, 60)}…</Text>
    </Pressable>
  );

  const filterChips = (
    <View style={s.filters}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Buscar en asunto…"
        placeholderTextColor="#94a3b8"
        style={s.search}
        returnKeyType="search"
        accessibilityLabel="Buscar solicitudes"
      />
      <Text style={s.filterLabel}>Estado</Text>
      <View style={s.chips}>
        <Chip label="Todos" active={!estado} onPress={() => setEstado('')} />
        {ESTADOS.map((e) => <Chip key={e} label={e} active={estado === e} onPress={() => setEstado(e)} />)}
      </View>
      <Text style={s.filterLabel}>Prioridad</Text>
      <View style={s.chips}>
        <Chip label="Todas" active={!prioridad} onPress={() => setPrioridad('')} />
        {PRIORIDADES.map((p) => <Chip key={p} label={p} active={prioridad === p} onPress={() => setPrioridad(p)} />)}
      </View>
      <Text style={s.total}>{total} resultado{total !== 1 ? 's' : ''}</Text>
    </View>
  );

  if (loading) {
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>Cargando solicitudes…</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={tickets}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        ListHeaderComponent={filterChips}
        ListEmptyComponent={<View style={s.center}><Text style={s.muted}>Sin solicitudes — crea tu primer ticket</Text><Pressable onPress={() => navigation.navigate('CrearTicket')} style={s.primaryBtn}><Text style={s.primaryBtnText}>Crear solicitud</Text></Pressable></View>}
        ListFooterComponent={loadingMore ? <View style={{ padding: 16 }}><ActivityIndicator /></View> : hasMore ? <Text style={s.mutedCenter}>Desliza para cargar más</Text> : tickets.length ? <Text style={s.mutedCenter}>Fin de la lista</Text> : null}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12, gap: 8 }}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]} accessibilityRole="button" accessibilityLabel={`Filtro ${label}`} accessibilityState={{ selected: active }}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function prioridadColor(p: string) {
  if (p === 'critica') return { backgroundColor: '#dc2626' };
  if (p === 'alta') return { backgroundColor: '#ea580c' };
  if (p === 'media') return { backgroundColor: '#2563eb' };
  return { backgroundColor: '#16a34a' };
}
function estadoColor(e: string) {
  if (e === 'abierto') return { backgroundColor: '#64748b' };
  if (e === 'en_proceso') return { backgroundColor: '#7c3aed' };
  if (e === 'solucionado') return { backgroundColor: '#059669' };
  if (e === 'cerrado') return { backgroundColor: '#334155' };
  return { backgroundColor: '#94a3b8' };
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { color: theme.colors.muted, fontSize: 12, textAlign: 'center' },
  mutedCenter: { color: theme.colors.muted, fontSize: 11, textAlign: 'center', padding: 12 },
  filters: { gap: 8, marginBottom: 8 },
  search: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, backgroundColor: theme.colors.surface, color: theme.colors.primary },
  filterLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.muted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 11, color: theme.colors.primary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  total: { fontSize: 11, color: theme.colors.muted, textAlign: 'right' },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numero: { fontWeight: '700', color: theme.colors.primary, fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  asunto: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  meta: { fontSize: 11, color: theme.colors.muted },
  primaryBtn: { marginTop: 12, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.md },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
