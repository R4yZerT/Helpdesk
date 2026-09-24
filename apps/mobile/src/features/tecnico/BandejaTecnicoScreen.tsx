// RF-12 — Bandeja técnico asignados orden prioridad/antigüedad + Realtime
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { listAssignedTickets, fetchMesas, ejecutarBulk, BulkPanel, type BulkAccion, type BulkResultado, type EstadoTicket, type PrioridadTicket, type Ticket, type Mesa } from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { reportError } from '../../lib/sentry';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TecnicoStackParamList } from '../../navigation/types';
import { TicketRow } from '../tickets/components/TicketRow';
import { TicketFilters } from '../tickets/components/TicketFilters';

const PAGE_SIZE = 20;

type Props = { navigation: NativeStackNavigationProp<TecnicoStackParamList, 'Bandeja'> };

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
        onFallbackFulltext: (info) => reportError(new Error(info.motivo), { flujo: 'bandeja-fallback-ft', consulta: info.consulta }),
      });
      setTotal(res.total);
      setHasMore(res.hasMore);
      setPage(targetPage);
      setTickets((prev) => (opts.reset || isFirst ? res.data : [...prev, ...res.data]));
    } catch (e) {
      reportError(e, { flujo: 'bandeja-list' });
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

  const [mesas, setMesas] = useState<{ id: number; nombre: string }[]>([]);
  useEffect(() => { fetchMesas(supabase).then((m) => setMesas(m.map((x) => ({ id: x.id, nombre: x.nombre })))).catch(() => {}); }, []);
  const mesaName = useCallback((id: number | null) => mesas.find((m) => m.id === id)?.nombre ?? (id ? `Mesa ${id}` : '—'), [mesas]);
  // H10 — selección en lote
  const [modoBulk, setModoBulk] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [ejecutandoBulk, setEjecutandoBulk] = useState(false);
  const [resultadoBulk, setResultadoBulk] = useState<BulkResultado | null>(null);

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const onEjecutarBulk = useCallback(async (accion: BulkAccion, args: { solucion?: string; mesaId?: number }) => {
    setEjecutandoBulk(true);
    try {
      const r = await ejecutarBulk(supabase, {
        ids: seleccion,
        operacion: accion === 'cerrar' ? 'cerrar' : 'reasignar',
        solucion: args.solucion,
        mesaId: args.mesaId,
      });
      setResultadoBulk(r);
      setSeleccion([]);
      fetchPage(0, { reset: true });
    } catch (e) {
      reportError(e, { flujo: 'bandeja-bulk' });
    } finally {
      setEjecutandoBulk(false);
    }
  }, [seleccion, fetchPage]);

  if (loading && tickets.length === 0) {
    return <View style={s.center}><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando bandeja…</Text></View>;
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.kicker}>Técnico · Orden prioridad → antigüedad</Text>
        <Text style={s.h1}>Bandeja asignada</Text>
        <Pressable onPress={() => { setModoBulk((v) => !v); setSeleccion([]); setResultadoBulk(null); }} accessibilityRole="button" accessibilityLabel="Selección en lote">
          <Text style={s.bulkToggle}>{modoBulk ? 'Cancelar selección' : 'Selección en lote'}</Text>
        </Pressable>
      </View>
      <TicketFilters
        q={q}
        setQ={setQ}
        estado={estado}
        setEstado={(v) => setEstado(v as EstadoTicket | '')}
        prioridad={prioridad}
        setPrioridad={(v) => setPrioridad(v as PrioridadTicket | '')}
        total={total}
        activos={total}
        qDebounced={qDebounced}
        onReset={() => { setEstado(''); setPrioridad(''); setQ(''); }}
      />
      <FlatList data={tickets} keyExtractor={(t) => t.id} renderItem={({ item }) => (
        <View style={s.row}>
          {modoBulk ? (
            <Pressable
              onPress={() => toggleSeleccion(item.id)}
              style={[s.check, seleccion.includes(item.id) && s.checkActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: seleccion.includes(item.id) }}
              accessibilityLabel={`Seleccionar ticket #${item.numero}`}
            >
              <Text style={[s.checkText, seleccion.includes(item.id) && s.checkTextActive]}>{seleccion.includes(item.id) ? '✓' : ''}</Text>
            </Pressable>
          ) : null}
          <View style={s.rowContent}>
            <TicketRow ticket={item} mesaName={mesaName} tecnicoNombres={{}} onPress={() => (modoBulk ? toggleSeleccion(item.id) : navigation.navigate('DetalleTicket', { id: item.id }))} />
          </View>
        </View>
      )} onEndReached={onEndReached} onEndReachedThreshold={0.4} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />} ListEmptyComponent={<View style={s.empty}><Text style={s.muted}>Sin tickets asignados</Text></View>} ListFooterComponent={loadingMore ? <View style={s.footer}><ActivityIndicator color={theme.colors.primary} /></View> : null} contentContainerStyle={s.listContent} />
      {modoBulk || resultadoBulk ? (
        <BulkPanel
          seleccionados={seleccion.length}
          acciones={['cerrar', 'mesa']}
          mesas={mesas}
          ejecutando={ejecutandoBulk}
          resultado={resultadoBulk}
          onLimpiar={() => setSeleccion([])}
          onEjecutar={onEjecutarBulk}
          onCerrarResultado={() => setResultadoBulk(null)}
        />
      ) : null}
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
  empty: { alignItems: 'center', padding: 24 },
  listContent: { padding: 12, gap: 10, paddingBottom: 24 },
  footer: { padding: 16, alignItems: 'center' },
  bulkToggle: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowContent: { flex: 1 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  checkActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkText: { fontSize: 14, fontWeight: '800', color: 'transparent' },
  checkTextActive: { color: '#fff' },
});