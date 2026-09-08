// RF-12 — Bandeja técnico asignados orden prioridad/antigüedad + Realtime
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
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
  if (p === 'critica') return 'accent' as const; // naranja solo crítico
  if (p === 'alta') return 'danger' as const;
  if (p === 'media') return 'warning' as const;
  return 'muted' as const;
};
const prettyEstado = (e: string) => e.replace('_', ' ');

export function BandejaTecnicoScreen({ navigation }: Props) {
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
      console.warn('[Bandeja] listAssignedTickets', e);
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

  const renderItem = ({ item }: { item: Ticket }) => (
    <Pressable onPress={() => navigation.navigate('DetalleTicket', { id: item.id })} style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.96 }]}>
      <Card style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.numero}>#{String(item.numero).padStart(4, '0')}</Text>
          <View style={s.badges}><Badge label={item.prioridad} tone={tonoPrioridad(item.prioridad)} /><Badge label={prettyEstado(item.estado)} tone={tonoEstado(item.estado)} /></View>
        </View>
        <Text style={s.asunto} numberOfLines={2}>{item.asunto}</Text>
        <Text style={s.desc} numberOfLines={2}>{item.descripcion}</Text>
        <Divider />
        <Text style={s.meta}>{new Date(item.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · Mesa {item.mesaId} · #{item.numero}</Text>
        {item.fechaResolucion ? <Text style={s.metaSoft}>Resuelto {new Date(item.fechaResolucion).toLocaleDateString('es-ES')}</Text> : null}
      </Card>
    </Pressable>
  );

  if (loading && tickets.length === 0) {
    return <View style={s.center}><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando bandeja…</Text></View>;
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar en asunto" placeholderTextColor={theme.colors.mutedSoft} style={s.search} returnKeyType="search" accessibilityLabel="Buscar bandeja" />
          {!!q && <Pressable onPress={() => setQ('')} style={s.clearBtn}><Text style={s.clearText}>×</Text></Pressable>}
        </View>
        <View style={s.chipsRow}>
          {(['' as const, ...ESTADOS] as const).map((e) => (
            <Pressable key={String(e)} onPress={() => setEstado(e as EstadoTicket | '')} style={[s.chip, estado === e && s.chipActive]}>
              <Text style={[s.chipText, estado === e && s.chipTextActive]}>{e ? prettyEstado(e) : 'Todos'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.chipsRow}>
          {(['' as const, ...PRIORIDADES] as const).map((p) => (
            <Pressable key={String(p)} onPress={() => setPrioridad(p as PrioridadTicket | '')} style={[s.chip, prioridad === p && s.chipActive]}>
              <Text style={[s.chipText, prioridad === p && s.chipTextActive]}>{p || 'Todas'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList data={tickets} keyExtractor={(t) => t.id} renderItem={renderItem} onEndReached={onEndReached} onEndReachedThreshold={0.4} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />} ListEmptyComponent={<View style={s.empty}><Text style={s.muted}>Sin tickets asignados</Text></View>} ListFooterComponent={loadingMore ? <View style={s.footer}><ActivityIndicator color={theme.colors.primary} /></View> : null} contentContainerStyle={s.listContent} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.bg, padding: 24 },
  muted: { color: theme.colors.muted, fontSize: 12 },
  header: { padding: 16, gap: 8, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: theme.colors.muted, textTransform: 'uppercase' },
  h1: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 10, height: 38 },
  searchIcon: { color: theme.colors.mutedSoft, marginRight: 6 },
  search: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  clearBtn: { padding: 4 },
  clearText: { fontSize: 16, color: theme.colors.muted },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },
  chipTextActive: { color: '#fff' },
  listContent: { padding: 12, gap: 10, paddingBottom: 24 },
  cardPress: { borderRadius: 16 },
  card: { gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { fontSize: 11, fontWeight: '800', color: theme.colors.muted },
  badges: { flexDirection: 'row', gap: 6 },
  asunto: { fontSize: 14, fontWeight: '700', color: theme.colors.text, lineHeight: 18 },
  desc: { fontSize: 12, color: theme.colors.textSoft, lineHeight: 16 },
  meta: { fontSize: 11, color: theme.colors.muted },
  metaSoft: { fontSize: 11, color: theme.colors.mutedSoft },
  empty: { alignItems: 'center', padding: 24 },
  footer: { padding: 16, alignItems: 'center' },
});
