// RF-08 — Mis solicitudes: server paginado + Realtime + pull-to-refresh
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { fetchMesas, fetchTecnicoNombres, listMyTickets, type EstadoTicket, type PrioridadTicket, type Ticket, type Mesa } from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EmpleadoStackParamList } from '../../navigation/types';
import { TicketRow } from './components/TicketRow';
import { TicketFilters } from './components/TicketFilters';

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
  const [tecnicoNombres, setTecnicoNombres] = useState<Record<string, string>>({});
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
    const ids = tickets.map((t) => t.tecnicoAsignadoId).filter((x): x is string => !!x && !tecnicoNombres[x]);
    if (ids.length === 0) return;
    let alive = true;
    fetchTecnicoNombres(supabase, ids).then((map) => {
      if (alive && Object.keys(map).length > 0) setTecnicoNombres((prev) => ({ ...prev, ...map }));
    }).catch(() => {});
    return () => { alive = false; };
  }, [tickets]);

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
      <TicketFilters
        q={q}
        setQ={setQ}
        estado={estado}
        setEstado={setEstado}
        prioridad={prioridad}
        setPrioridad={setPrioridad}
        total={total}
        activos={activos}
        qDebounced={qDebounced}
        onReset={() => { setEstado(''); setPrioridad(''); setQ(''); }}
      />
      <FlatList
        data={tickets}
        key={isWide ? 'grid-2' : 'grid-1'}
        numColumns={isWide ? 2 : 1}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TicketRow ticket={item} mesaName={mesaName} tecnicoNombres={tecnicoNombres} onPress={() => navigation.navigate('DetalleTicket', { id: item.id })} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Sin solicitudes</Text>
            <Text style={s.emptySub}>Aún no has creado tickets. Crea tu primera solicitud y aparecerá aquí.</Text>
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
      <Pressable onPress={() => navigation.navigate('CrearTicket')} style={s.fab} accessibilityRole="button" accessibilityLabel="Crear nueva solicitud">
        <Text style={s.fabIcon}>＋</Text>
        <Text style={s.fabText}>Nuevo Ticket</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg },
  loadingCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 10 },
  muted: { color: theme.colors.muted, fontSize: 12, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 8, padding: 18, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  emptySub: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', lineHeight: 17 },
  primaryBtn: { marginTop: 6, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 11, borderRadius: theme.radius.full },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  footerHint: { color: theme.colors.mutedSoft, fontSize: 11, textAlign: 'center', padding: 14, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surfaceAlt, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  bannerText: { fontSize: 12, color: theme.colors.muted, fontWeight: '600', flex: 1 },
  bannerBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  bannerBtnText: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: theme.colors.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: '#FED7AA', alignItems: 'center', gap: 4, ...theme.shadow.soft as object },
  fabIcon: { color: '#fff', fontSize: 22, fontWeight: '800' },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 11 },
});