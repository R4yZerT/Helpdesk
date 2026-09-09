// RF replanteo — Admin: tickets de su dependencia (mesa) con asignación a técnico de la misma dependencia
// Scoping: admin ve solo tickets donde mesa_id == profile.mesa_id (TIC solo TIC). Si admin sin mesa -> vacio + aviso.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme, Card, FeedbackModal, listMyTickets, reassignTicket, type Ticket, formatEstado, formatPrioridad, FilterDropdown, PRIORIDAD_OPTIONS, buildExportFilename, downloadCsv } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../context/AuthContext';

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

const PRIORITY_COLOR: Record<string,string> = { critica: '#DC2626', alta: '#FB923C', media: '#0E87E2', baja: '#64748B' };
function priorityColor(p: string){ return PRIORITY_COLOR[p] ?? theme.colors.primaryDark; }


export function AdminMesaTicketsScreen() {
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
  const [assignId, setAssignId] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);

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
      const res = await listMyTickets(supabase as never, { mesaId: mesaId as number, q: qDeb || undefined, tecnicoId: tecnicoIdParam, prioridad: (prioridadFilter as any) || undefined, page: 0, pageSize: 50 });
      setTickets(res.data); setTotal(res.total);
    } catch (e) { const m=getErrorMessage(e); setErrorMsg(m); } finally { setLoading(false); }
  }, [mesaId, qDeb, tecnicoFilter, asignacionFilter, prioridadFilter]);

  useEffect(()=>{ fetchTickets(); }, [fetchTickets]);

  // cargar técnicos para filtro
  useEffect(() => {
    if (mesaId == null) { setTecnicos([]); return; }
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('id,full_name,email').eq('mesa_id', mesaId).eq('rol', 'tecnico').eq('activo', true).order('full_name');
        setTecnicos((data ?? []) as TecnicoOpt[]);
      } catch {}
    })();
  }, [mesaId]);

  const onExportCsv = useCallback(() => {
    try {
      const header = ['numero', 'asunto', 'estado', 'prioridad', 'tecnico'];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csvRows = tickets.map((t) => [String(t.numero), t.asunto.replace(/\r?\n/g, ' '), formatEstado(t.estado as never), formatPrioridad(t.prioridad as never), t.tecnicoAsignadoId ?? 'Sin asignar']);
      const csv = [header.map(esc).join(','), ...csvRows.map((r) => r.map(esc).join(','))].join('\r\n');
      const meta = [`# Generado: ${new Date().toISOString()}`, `# Registros: ${tickets.length}`, `# Mesa: ${mesaId ?? '—'}`].join('\r\n') + '\r\n' + csv;
      const ok = downloadCsv(buildExportFilename('admin-mesa-tickets', 'csv'), meta);
      if (!ok) window.alert(`CSV generado (${tickets.length} filas).`);
    } catch (e: any) { console.warn('[AdminMesaTickets] export csv', e); alert(e?.message ?? 'Error al exportar CSV'); }
  }, [tickets, mesaId]);
  const onExportPng = useCallback(async () => {
    try {
      if (Platform.OS !== 'web' || typeof document === 'undefined') { alert('Exportar PNG solo disponible en web'); return; }
      const el = document.getElementById('admin-export-root') as HTMLElement | null;
      if (!el) { alert('No se encontró el contenedor de tickets'); return; }
      // html2canvas importado estático arriba — evita Cannot find module en Metro web
      const canvas = await (html2canvas as any)(el, { backgroundColor: '#F8FAFC', scale: 2, useCORS: true, logging: false });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = buildExportFilename('admin-mesa-tickets', 'png'); a.click();
    } catch (e: any) { console.warn('[AdminMesaTickets] export png', e); alert(e?.message ? `Error al exportar PNG: ${e.message}` : 'Error al exportar PNG'); }
  }, []);
  const onExportPdf = useCallback(async () => {
    try {
      if (Platform.OS !== 'web' || typeof document === 'undefined') { alert('Exportar PDF solo disponible en web'); return; }
      const el = document.getElementById('admin-export-root') as HTMLElement | null;
      if (!el) { alert('No se encontró el contenedor de tickets'); return; }
      // html2canvas importado estático arriba — evita Cannot find module en Metro web
      // jsPDF importado estático arriba
      const canvas = await (html2canvas as any)(el, { backgroundColor: '#FFFFFF', scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(buildExportFilename('admin-mesa-tickets', 'pdf'));
    } catch (e: any) { console.warn('[AdminMesaTickets] export pdf', e); alert(e?.message ? `Error al exportar PDF: ${e.message}` : 'Error al exportar PDF'); }
  }, []);
  const openAssign = async (t: Ticket) => {
    setAssignOpen(t); setAssignId(t.tecnicoAsignadoId ?? '');
    // fetch tecnicos de esa mesa
    try {
      const { data, error } = await supabase.from('profiles').select('id,full_name,email,rol').eq('mesa_id', t.mesaId).in('rol', ['tecnico']).eq('activo', true).order('full_name');
      if (error) throw error;
      setTecnicos((data ?? []) as TecnicoOpt[]);
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
      </View>
      <View nativeID="admin-export-root" style={{ flex: 1 }}>
      <FlatList data={tickets} keyExtractor={t=>t.id} contentContainerStyle={s.listContent}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>Sin tickets</Text><Text style={s.mutedCenter}>No hay tickets para esta dependencia.</Text></View>}
        renderItem={({item})=> (
          <Card style={s.card}>
            <View style={s.cardTop}><Text style={s.cardId}>#{item.numero} · {formatEstado(item.estado as never)}</Text><Text style={[s.priority, { color: priorityColor(item.prioridad) }]}>{formatPrioridad(item.prioridad as never)}</Text></View>
            <Text style={s.name} numberOfLines={2}>{item.asunto}</Text>
            <Text style={s.muted} numberOfLines={2}>{item.descripcion}</Text>
            <View style={s.actions}>
              <Text style={s.muted}>Técnico: {item.tecnicoAsignadoId ?? 'Sin asignar'}</Text>
              <Pressable onPress={()=>openAssign(item)} style={s.btnGhost}><Text style={s.btnGhostText}>Asignar técnico</Text></Pressable>
            </View>
          </Card>
        )}
      />
      </View>
      <Modal visible={!!assignOpen} transparent animationType="fade" onRequestClose={()=>setAssignOpen(null)}>
        <View style={s.modalBackdrop}><View style={s.modalCard}>
          <Text style={s.modalTitle}>Asignar técnico · #{assignOpen?.numero}</Text>
          <Text style={s.modalHint}>Solo técnicos de la dependencia {assignOpen?.mesaId}</Text>
          {tecnicos.length===0? <Text style={s.muted}>Sin técnicos en esta dependencia</Text>:
            tecnicos.map(t=> (
              <Pressable key={t.id} onPress={()=>setAssignId(t.id)} style={[s.techRow, assignId===t.id && s.techRowActive]}><Text style={s.techText}>{t.full_name ?? t.email ?? t.id}</Text></Pressable>
            ))
          }
          <Pressable onPress={()=>setAssignId('')} style={[s.techRow, !assignId && s.techRowActive]}><Text style={s.techText}>Sin asignar</Text></Pressable>
          <View style={s.modalActions}>
            <Pressable onPress={()=>setAssignOpen(null)} style={s.btnGhost}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable onPress={doAssign} disabled={assignLoading} style={[s.btnPrimary, assignLoading && {opacity:0.6}]}><Text style={s.btnPrimaryText}>{assignLoading?'Guardando…':'Guardar'}</Text></Pressable>
          </View>
        </View></View>
      </Modal>
      {feedback? <FeedbackModal visible={feedback.visible} variant={feedback.variant as never} title={feedback.title} message={feedback.message} onClose={()=>setFeedback(null)} onConfirm={()=>setFeedback(null)}/>:null}
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
  card:{gap:8, flex:1},
  cardTop:{flexDirection:'row', justifyContent:'space-between'},
  cardId:{fontSize:10, fontWeight:'700', color:theme.colors.mutedSoft},
  priority:{fontSize:10, fontWeight:'800', color:theme.colors.primaryDark},
  name:{fontSize:14, fontWeight:'800', color:theme.colors.text},
  actions:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:4},
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
