// RF replanteo — Admin: tickets de su dependencia (mesa) con asignación a técnico de la misma dependencia
// Scoping: admin ve solo tickets donde mesa_id == profile.mesa_id (TIC solo TIC). Si admin sin mesa -> vacio + aviso.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { theme, Card, Badge, Divider, TecnicoChip, FeedbackModal, listMyTickets, reassignTicket, ejecutarBulk, BulkPanel, fetchTecnicoNombres, type BulkAccion, type BulkResultado, type Ticket, type PrioridadTicket, formatEstado, formatPrioridad, FilterDropdown, PRIORIDAD_OPTIONS } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { reportError } from '../../lib/sentry';
import { exportTableCsv, exportTablePdf, exportTablePng, type ExportTable } from '../../lib/exportTable';
import { useAuth } from '../../context/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';

function getErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) return o.message;
    if (typeof o.error === 'string' && o.error.trim()) return o.error;
    try { const j = JSON.stringify(o); if (j !== '{}') return j; } catch {}
  }
  return String(e ?? 'Error desconocido');
}

type TecnicoOpt = { id: string; full_name: string | null; email: string | null };

function prioridadTone(p: string): 'success' | 'warning' | 'danger' | 'accent' | 'info' {
  if (p === 'critica') return 'accent';
  if (p === 'alta') return 'danger';
  if (p === 'media') return 'warning';
  return 'success';
}
function estadoTone(e: string): 'muted' | 'info' | 'success' | 'ink' | 'danger' {
  if (e === 'abierto') return 'muted';
  if (e === 'en_proceso') return 'info';
  if (e === 'solucionado') return 'success';
  if (e === 'cerrado') return 'ink';
  if (e === 'devuelto') return 'danger';
  return 'muted';
}

type Props = { navigation?: NativeStackNavigationProp<AdminStackParamList, 'MesaTickets'> };

export function AdminMesaTicketsScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const { profile } = useAuth();
  const mesaId = (profile as unknown as { mesa_id?: number | null })?.mesa_id ?? (profile as unknown as { mesaId?: number | null })?.mesaId ?? null;
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tecnicoFilter, setTecnicoFilter] = useState<string | ''>('');
  const [asignacionFilter, setAsignacionFilter] = useState<string>('');
  const [prioridadFilter, setPrioridadFilter] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  const [feedback, setFeedback] = useState<{visible:boolean; variant:'success'|'error'|'info'; title:string; message?:string}|null>(null);
  const [assignOpen, setAssignOpen] = useState<Ticket|null>(null);
  const [tecnicos, setTecnicos] = useState<TecnicoOpt[]>([]);
  const [tecnicoNombres, setTecnicoNombres] = useState<Record<string, string>>({});
  const [assignId, setAssignId] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);
  // H10 — prioridad en lote (solo admin: RLS rechaza a otros roles por ítem)
  const [modoBulk, setModoBulk] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [ejecutandoBulk, setEjecutandoBulk] = useState(false);
  const [resultadoBulk, setResultadoBulk] = useState<BulkResultado | null>(null);

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setQDeb(q.trim()), 700);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [q]);

  const fetchTickets = useCallback(async () => {
    if (mesaId == null) { setTickets([]); setTotal(0); setLoading(false); return; }
    setLoading(true); setErrorMsg(null);
    try {
      let tecnicoIdParam: string | null | undefined = undefined;
      if (tecnicoFilter) {
        tecnicoIdParam = tecnicoFilter === '__unassigned' ? null : tecnicoFilter;
      } else if (asignacionFilter === 'asignadas') tecnicoIdParam = '__assigned';
      else if (asignacionFilter === 'no_asignadas') tecnicoIdParam = null;
      const res = await listMyTickets(supabase as never, { mesaId: mesaId as number, q: qDeb || undefined, tecnicoId: tecnicoIdParam, prioridad: (prioridadFilter as PrioridadTicket) || undefined, page: 0, pageSize: 50 });
      setTickets(res.data); setTotal(res.total);
    } catch (e) { const m=getErrorMessage(e); setErrorMsg(m); } finally { setLoading(false); }
  }, [mesaId, qDeb, tecnicoFilter, asignacionFilter, prioridadFilter]);

  useEffect(()=>{ fetchTickets(); }, [fetchTickets]);

  const onEjecutarBulk = useCallback(async (_accion: BulkAccion, args: { prioridad?: PrioridadTicket }) => {
    setEjecutandoBulk(true);
    try {
      const r = await ejecutarBulk(supabase as never, { ids: seleccion, operacion: 'prioridad', prioridad: args.prioridad });
      setResultadoBulk(r);
      setSeleccion([]);
      setFeedback({ visible: true, variant: r.fallos ? 'info' : 'success', title: `Lote: ${r.ok} ok, ${r.fallos} fallos`, message: r.items.filter((i) => !i.ok).slice(0, 3).map((i) => `${i.id.slice(0, 8)}: ${i.error}`).join(' · ') || undefined });
      fetchTickets();
    } catch (e) {
      reportError(e, { flujo: 'admin-bulk' });
      setFeedback({ visible: true, variant: 'error', title: 'Error en lote', message: getErrorMessage(e) });
    } finally {
      setEjecutandoBulk(false);
    }
  }, [seleccion, fetchTickets]);

  // cargar técnicos para filtro (solo misma dependencia del admin)
  useEffect(() => {
    if (mesaId == null) { setTecnicos([]); return; }
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('id,full_name,email').eq('mesa_id', mesaId).eq('rol', 'tecnico').eq('activo', true).order('full_name');
        const list = (data ?? []) as TecnicoOpt[];
        setTecnicos(list);
        // precarga mapa de nombres para no mostrar UID en filtros/tarjetas
        setTecnicoNombres((prev) => {
          const next = { ...prev };
          for (const t of list) next[t.id] = t.full_name ?? t.email ?? t.id;
          return next;
        });
      } catch {}
    })();
  }, [mesaId]);

  // Resolver nombres de técnicos asignados vía RPC segura (respeta RLS de profiles)
  useEffect(() => {
    const ids = tickets.map((t) => t.tecnicoAsignadoId).filter((x): x is string => !!x && !tecnicoNombres[x]);
    if (ids.length === 0) return;
    let alive = true;
    fetchTecnicoNombres(supabase as never, ids).then((map) => {
      if (alive && Object.keys(map).length > 0) setTecnicoNombres((prev) => ({ ...prev, ...map }));
    }).catch(() => {});
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  // Exportación desde datos completos (no solo la página visible ni screenshots).
  // listMyTickets limita pageSize a 50 → se itera por páginas con los mismos filtros.
  const fetchAllForExport = useCallback(async (): Promise<Ticket[]> => {
    if (mesaId == null) return [];
    let tecnicoIdParam: string | null | undefined = undefined;
    if (tecnicoFilter) {
      tecnicoIdParam = tecnicoFilter === '__unassigned' ? null : tecnicoFilter;
    } else if (asignacionFilter === 'asignadas') tecnicoIdParam = '__assigned';
    else if (asignacionFilter === 'no_asignadas') tecnicoIdParam = null;
    const all: Ticket[] = [];
    let page = 0;
    for (;;) {
      const res = await listMyTickets(supabase as never, { mesaId: mesaId as number, q: qDeb || undefined, tecnicoId: tecnicoIdParam, prioridad: (prioridadFilter as PrioridadTicket) || undefined, page, pageSize: 50 });
      all.push(...res.data);
      if (!res.hasMore || res.data.length === 0) break;
      page += 1;
    }
    // Resolver nombres de técnicos que aún no están en el mapa (para no exportar UID)
    const missing = [...new Set(all.map((t) => t.tecnicoAsignadoId).filter((x): x is string => !!x && !tecnicoNombres[x]))];
    if (missing.length > 0) {
      try {
        const map = await fetchTecnicoNombres(supabase as never, missing);
        if (Object.keys(map).length > 0) setTecnicoNombres((prev) => ({ ...prev, ...map }));
        for (const [k, v] of Object.entries(map)) tecnicoNombres[k] = v;
      } catch {}
    }
    return all;
  }, [mesaId, qDeb, tecnicoFilter, asignacionFilter, prioridadFilter, tecnicoNombres]);

  const buildTable = useCallback((all: Ticket[], nombres: Record<string, string>): ExportTable => ({
    title: 'Tickets de la dependencia',
    subtitle: `Mesa ${mesaId ?? '—'}`,
    header: ['numero', 'asunto', 'estado', 'prioridad', 'tecnico'],
    rows: all.map((t) => [String(t.numero), t.asunto.replace(/\r?\n/g, ' '), formatEstado(t.estado as never), formatPrioridad(t.prioridad as never), t.tecnicoAsignadoId ? (nombres[t.tecnicoAsignadoId] ?? 'Técnico asignado') : 'Sin asignar']),
  }), [mesaId]);

  const onExportCsv = useCallback(async () => {
    try {
      const table = buildTable(await fetchAllForExport(), tecnicoNombres);
      const { count, ok } = exportTableCsv('admin-mesa-tickets', table);
      setFeedback({ visible: true, variant: ok ? 'success' : 'info', title: ok ? 'CSV listo' : 'CSV generado', message: `Se generaron ${count} filas (dataset completo).` });
    } catch (e: unknown) { reportError(e, { flujo: 'admin-mesa-export-csv' }); setFeedback({ visible:true, variant:'error', title:'Error al exportar CSV', message:getErrorMessage(e) }); }
  }, [fetchAllForExport, buildTable, tecnicoNombres]);
  const onExportPng = useCallback(async () => {
    try {
      const table = buildTable(await fetchAllForExport(), tecnicoNombres);
      const { count } = await exportTablePng('admin-mesa-tickets', table);
      setFeedback({ visible:true, variant:'success', title:'PNG listo', message:`Se generaron ${count} filas (dataset completo).` });
    } catch (e: unknown) { reportError(e, { flujo: 'admin-mesa-export-png' }); setFeedback({ visible:true, variant:'error', title:'Error al exportar PNG', message:getErrorMessage(e) }); }
  }, [fetchAllForExport, buildTable, tecnicoNombres]);
  const onExportPdf = useCallback(async () => {
    try {
      const table = buildTable(await fetchAllForExport(), tecnicoNombres);
      const { count } = exportTablePdf('admin-mesa-tickets', table);
      setFeedback({ visible:true, variant:'success', title:'PDF listo', message:`Se generaron ${count} filas (dataset completo).` });
    } catch (e: unknown) { reportError(e, { flujo: 'admin-mesa-export-pdf' }); setFeedback({ visible:true, variant:'error', title:'Error al exportar PDF', message:getErrorMessage(e) }); }
  }, [fetchAllForExport, buildTable, tecnicoNombres]);
  const openAssign = async (t: Ticket) => {
    setAssignOpen(t); setAssignId(t.tecnicoAsignadoId ?? '');
    // fetch técnicos de esa mesa (misma dependencia del ticket)
    try {
      const { data, error } = await supabase.from('profiles').select('id,full_name,email,rol').eq('mesa_id', t.mesaId).in('rol', ['tecnico']).eq('activo', true).order('full_name');
      if (error) throw error;
      const list = (data ?? []) as TecnicoOpt[];
      setTecnicos(list);
      setTecnicoNombres((prev) => {
        const next = { ...prev };
        for (const x of list) next[x.id] = x.full_name ?? x.email ?? x.id;
        return next;
      });
    } catch {}
  };

  const doAssign = async () => {
    if (!assignOpen) return;
    setAssignLoading(true);
    try {
      await reassignTicket(supabase as never, assignOpen.id, { tecnicoId: assignId || null });
      setTickets(prev=> prev.map(x=> x.id===assignOpen.id? {...x, tecnicoAsignadoId: assignId || null}:x));
      setFeedback({ visible:true, variant:'success', title:'Ticket asignado', message:`Ticket #${assignOpen.numero} asignado correctamente`});
      setAssignOpen(null);
    } catch (e) { setFeedback({ visible:true, variant:'error', title:'Error al asignar', message:getErrorMessage(e)}); } finally { setAssignLoading(false); }
  };

  if (mesaId == null) {
    return <View style={s.center}><Text style={s.emptyTitle}>Sin dependencia asignada</Text><Text style={s.mutedCenter}>Tu perfil no tiene mesa asignada. Contacta a un administrador.</Text></View>;
  }
  if (loading) return <View style={s.center}><ActivityIndicator color={theme.colors.primary}/><Text style={s.muted}>Cargando tickets…</Text></View>;

  return (
    <View style={s.wrap}>
      {errorMsg? <View style={s.header}><Text style={s.error}>{errorMsg}</Text></View>:null}
      <View style={s.filterCard}>
        <View style={s.searchWrap}><Text style={s.searchIcon}>⌕</Text><TextInput value={q} onChangeText={setQ} placeholder="Buscar por ticket (#, asunto)" placeholderTextColor={theme.colors.mutedSoft} style={s.search} returnKeyType="search" />{!!q && <Pressable onPress={()=>setQ('')} style={s.clearBtn}><Text style={s.clearText}>×</Text></Pressable>}</View>
        <View style={s.dropdownRow}>
          <FilterDropdown label="Técnico" value={tecnicoFilter as never} options={[{ value: '' as never, label: 'Todos' }, ...tecnicos.map(t=> ({ value: t.id as never, label: (t.full_name ?? t.email ?? t.id) }))]} onSelect={v=> { setTecnicoFilter(v as string); if (v) setAsignacionFilter(''); }} placeholder="Todos" />
          <FilterDropdown label="Asignación" value={asignacionFilter as never} options={[{ value: '' as never, label: 'Todas' }, { value: 'asignadas' as never, label: 'Asignadas' }, { value: 'no_asignadas' as never, label: 'Sin asignar' }]} onSelect={v=> { setAsignacionFilter(v as string); if (v) setTecnicoFilter(''); }} placeholder="Todas" />
          <FilterDropdown label="Prioridad" value={prioridadFilter as never} options={PRIORIDAD_OPTIONS as never} onSelect={v=> setPrioridadFilter(v as string)} placeholder="Todas" />
        </View>
      </View>
      <View style={s.exportRow}>
        <Pressable onPress={onExportCsv} style={s.exportBtn} accessibilityRole="button"><Text style={s.exportBtnText}>CSV</Text></Pressable>
        <Pressable onPress={onExportPng} style={[s.exportBtn, s.exportBtnGhost]} accessibilityRole="button"><Text style={[s.exportBtnText, { color: theme.colors.text }]}>PNG</Text></Pressable>
        <Pressable onPress={onExportPdf} style={[s.exportBtn, s.exportBtnGhost]} accessibilityRole="button"><Text style={[s.exportBtnText, { color: theme.colors.text }]}>PDF</Text></Pressable>
        <Pressable onPress={() => { setModoBulk((v) => !v); setSeleccion([]); setResultadoBulk(null); }} style={[s.exportBtn, s.exportBtnGhost]} accessibilityRole="button" accessibilityLabel="Selección en lote"><Text style={[s.exportBtnText, { color: theme.colors.text }]}>{modoBulk ? 'Cancelar selección' : 'Lote'}</Text></Pressable>
      </View>
      <View nativeID="admin-export-root" style={{ flex: 1 }}>
      <FlatList data={tickets} keyExtractor={t=>t.id} contentContainerStyle={s.listContent}
        numColumns={isWide ? 2 : 1}
        key={isWide ? 'grid-2' : 'list-1'}
        columnWrapperStyle={isWide ? { gap: 12 } : undefined}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>Sin tickets</Text><Text style={s.mutedCenter}>No hay tickets para esta dependencia.</Text></View>}
        renderItem={({item})=> {
          const marcado = seleccion.includes(item.id);
          return (
          <Pressable
            onPress={() => (modoBulk ? toggleSeleccion(item.id) : (navigation as unknown as { navigate?: (name: string, params?: object) => void })?.navigate?.('DetalleTicket', { id: item.id }))}
            style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.96 }]}
            accessibilityRole="button"
            accessibilityLabel={`Ticket #${item.numero} ${item.asunto}`}
          >
          <Card style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.cardId}>#{String(item.numero).padStart(4, '0')}</Text>
              <View style={s.badges}>
                <Badge label={formatPrioridad(item.prioridad as never)} tone={prioridadTone(item.prioridad)} />
                <Badge label={formatEstado(item.estado as never)} tone={estadoTone(item.estado)} />
              </View>
            </View>
            {modoBulk ? (
              <Pressable onPress={() => toggleSeleccion(item.id)} style={[s.check, marcado && s.checkActive]} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }} accessibilityLabel={`Seleccionar ticket #${item.numero}`}>
                <Text style={[s.checkText, marcado && s.checkTextActive]}>{marcado ? '✓' : ''}</Text>
              </Pressable>
            ) : null}
            <Text style={s.name} numberOfLines={2}>{item.asunto}</Text>
            <Text style={s.muted} numberOfLines={2}>{item.descripcion}</Text>
            <Divider />
            <View style={s.metaRow}>
              <TecnicoChip nombre={item.tecnicoAsignadoId ? (tecnicoNombres[item.tecnicoAsignadoId] ?? 'Técnico asignado') : null} />
            </View>
            <View style={s.actions}>
              <Pressable onPress={()=>openAssign(item)} style={s.btnGhost} accessibilityRole="button" accessibilityLabel={`Asignar técnico ticket #${item.numero}`}><Text style={s.btnGhostText}>Asignar técnico</Text></Pressable>
            </View>
          </Card>
          </Pressable>
          );
        }}
      />
      </View>
      <Modal visible={!!assignOpen} transparent animationType="fade" onRequestClose={()=>setAssignOpen(null)}>
        <View style={s.modalBackdrop}><View style={s.modalCard}>
          <Text style={s.modalTitle}>Asignar técnico · #{assignOpen?.numero}</Text>
          <Text style={s.modalHint}>Solo técnicos de la dependencia {assignOpen?.mesaId}</Text>
          {tecnicos.length===0? <Text style={s.muted}>Sin técnicos en esta dependencia</Text>:
            <FilterDropdown
              label="Técnico de la dependencia"
              value={assignId as never}
              options={[{ value: '' as never, label: 'Sin asignar' }, ...tecnicos.map((t) => ({ value: t.id as never, label: (t.full_name ?? t.email ?? 'Técnico') }))]}
              onSelect={(v) => setAssignId(v as string)}
              placeholder="Seleccionar técnico"
            />
          }
          <View style={s.modalActions}>
            <Pressable onPress={()=>setAssignOpen(null)} style={s.btnGhost}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable onPress={doAssign} disabled={assignLoading} style={[s.btnPrimary, assignLoading && {opacity:0.6}]}><Text style={s.btnPrimaryText}>{assignLoading?'Guardando…':'Guardar'}</Text></Pressable>
          </View>
        </View></View>
      </Modal>
      {feedback? <FeedbackModal visible={feedback.visible} variant={feedback.variant as never} title={feedback.title} message={feedback.message} onClose={()=>setFeedback(null)} onConfirm={()=>setFeedback(null)}/>:null}
      {modoBulk || resultadoBulk ? (
        <BulkPanel
          seleccionados={seleccion.length}
          acciones={['prioridad']}
          mesas={[]}
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
  exportRow:{flexDirection:'row', gap:8, marginHorizontal:12, marginBottom:8, justifyContent:'flex-end'},
  exportBtn:{backgroundColor:theme.colors.primary, paddingHorizontal:12, height:32, borderRadius:theme.radius.sm, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:theme.colors.primary},
  exportBtnGhost:{backgroundColor:theme.colors.surface, borderColor:theme.colors.border},
  exportBtnText:{color:'#fff', fontWeight:'800', fontSize:11},
  wrap:{flex:1, backgroundColor:theme.colors.bg},
  center:{flex:1, alignItems:'center', justifyContent:'center', gap:10, backgroundColor:theme.colors.bg, padding:24},
  muted:{color:theme.colors.muted, fontSize:12},
  mutedCenter:{color:theme.colors.muted, fontSize:12, textAlign:'center'},
  error:{color:theme.colors.danger, fontSize:11, fontWeight:'600'},
  header:{paddingHorizontal:theme.space[4], paddingTop:theme.space[4], paddingBottom:theme.space[3], gap:8},
  kickerRow:{flexDirection:'row', alignItems:'center', gap:8},
  kickerDot:{width:6, height:6, borderRadius:999, backgroundColor:theme.colors.primary},
  kicker:{fontSize:10, fontWeight:'800', letterSpacing:1.1, color:theme.colors.muted},
  h1:{fontSize:22, fontWeight:'800', color:theme.colors.text},
  subtitle:{fontSize:12, color:theme.colors.muted, lineHeight:16},
  filterCard:{marginHorizontal:12, marginBottom:12, gap:12, backgroundColor:theme.colors.surface, borderRadius:theme.radius.lg, padding:16, borderWidth:1, borderColor:theme.colors.border},
  dropdownRow:{flexDirection:'row', gap:12, flexWrap:'wrap'},
  searchWrap:{flexDirection:'row', alignItems:'center', backgroundColor:theme.colors.surfaceAlt, borderWidth:1, borderColor:theme.colors.borderStrong, borderRadius:theme.radius.sm, paddingHorizontal:12, height:40},
  searchIcon:{color:theme.colors.mutedSoft, marginRight:8, fontSize:14},
  search:{flex:1, fontSize:13, color:theme.colors.text},
  clearBtn:{padding:6, marginLeft:6},
  clearText:{fontSize:18, color:theme.colors.muted, fontWeight:'600'},
  btnPrimary:{backgroundColor:theme.colors.primary, paddingHorizontal:16, height:40, borderRadius:theme.radius.sm, alignItems:'center', justifyContent:'center'},
  btnPrimaryText:{color:'#fff', fontWeight:'800', fontSize:12},
  listContent:{padding:12, gap:10, paddingBottom:24},
  cardPress:{flex:1},
  card:{gap:8, flex:1},
  badges:{flexDirection:'row', gap:6, alignItems:'center'},
  metaRow:{flexDirection:'row', alignItems:'center', marginTop:2},
  check:{width:26, height:26, borderRadius:13, borderWidth:2, borderColor:theme.colors.border, backgroundColor:theme.colors.surface, alignItems:'center', justifyContent:'center'},
  checkActive:{backgroundColor:theme.colors.primary, borderColor:theme.colors.primary},
  checkText:{fontSize:14, fontWeight:'800', color:'transparent'},
  checkTextActive:{color:'#fff'},
  cardTop:{flexDirection:'row', justifyContent:'space-between'},
  cardId:{fontSize:10, fontWeight:'700', color:theme.colors.mutedSoft},
  priority:{fontSize:10, fontWeight:'800', color:theme.colors.primaryDark},
  name:{fontSize:14, fontWeight:'800', color:theme.colors.text},
  actions:{flexDirection:'row', justifyContent:'flex-end', alignItems:'center', marginTop:4},
  btnGhost:{height:36, borderRadius:theme.radius.sm, borderWidth:1, borderColor:theme.colors.border, backgroundColor:theme.colors.surfaceAlt, alignItems:'center', justifyContent:'center', paddingHorizontal:12},
  btnGhostText:{fontSize:11, fontWeight:'700', color:theme.colors.text},
  empty:{alignItems:'center', padding:32, gap:10, backgroundColor:theme.colors.surface, borderRadius:theme.radius.lg, borderWidth:1, borderColor:theme.colors.border},
  emptyTitle:{fontSize:14, fontWeight:'700', color:theme.colors.text},
  modalBackdrop:{flex:1, backgroundColor:'rgba(15,23,42,0.45)', alignItems:'center', justifyContent:'center', padding:16},
  modalCard:{width:'100%', maxWidth:520, backgroundColor:theme.colors.surface, borderRadius:theme.radius.lg, padding:16, gap:12, borderWidth:1, borderColor:theme.colors.border},
  modalTitle:{fontSize:16, fontWeight:'800', color:theme.colors.text},
  modalHint:{fontSize:11, color:theme.colors.muted},
  techRow:{padding:10, borderWidth:1, borderColor:theme.colors.border, borderRadius:8, backgroundColor:theme.colors.surfaceAlt},
  techRowActive:{borderColor:theme.colors.primary, backgroundColor:theme.colors.primarySoft},
  techText:{fontSize:12, fontWeight:'700', color:theme.colors.text},
  modalActions:{flexDirection:'row', justifyContent:'flex-end', gap:10, marginTop:4},
});
