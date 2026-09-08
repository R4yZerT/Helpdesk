// RF replanteo — Admin: tickets de su dependencia (mesa) con asignación a técnico de la misma dependencia
// Scoping: admin ve solo tickets donde mesa_id == profile.mesa_id (TIC solo TIC). Si admin sin mesa -> vacio + aviso.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme, Card, FeedbackModal, listMyTickets, reassignTicket, type Ticket } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
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

export function AdminMesaTicketsScreen() {
  const { profile } = useAuth();
  const mesaId = (profile as unknown as { mesa_id?: number | null })?.mesa_id ?? (profile as unknown as { mesaId?: number | null })?.mesaId ?? null;
  const [q, setQ] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  const [feedback, setFeedback] = useState<{visible:boolean; variant:'success'|'error'|'info'; title:string; message?:string}|null>(null);
  const [assignOpen, setAssignOpen] = useState<Ticket|null>(null);
  const [tecnicos, setTecnicos] = useState<TecnicoOpt[]>([]);
  const [assignId, setAssignId] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (mesaId == null) { setTickets([]); setTotal(0); setLoading(false); return; }
    setLoading(true); setErrorMsg(null);
    try {
      const res = await listMyTickets(supabase as never, { mesaId: mesaId as number, q: q.trim() || undefined, page: 0, pageSize: 50 });
      setTickets(res.data); setTotal(res.total);
    } catch (e) { const m=getErrorMessage(e); setErrorMsg(m); } finally { setLoading(false); }
  }, [mesaId, q]);

  useEffect(()=>{ fetchTickets(); }, [fetchTickets]);

  const openAssign = async (t: Ticket) => {
    setAssignOpen(t); setAssignId(t.tecnicoAsignadoId ?? '');
    // fetch tecnicos de esa mesa
    try {
      const { data, error } = await supabase.from('profiles').select('id,full_name,email,rol').eq('mesa_id', t.mesaId).in('rol', ['tecnico','jefe']).eq('activo', true).order('full_name');
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
      setFeedback({ visible:true, variant:'success', title:'TICKET ASIGNADO', message:`TICKET #${assignOpen.numero} ASIGNADO CORRECTAMENTE`});
      setAssignOpen(null);
    } catch (e) { setFeedback({ visible:true, variant:'error', title:'ERROR AL ASIGNAR', message:getErrorMessage(e)}); } finally { setAssignLoading(false); }
  };

  if (mesaId == null) {
    return <View style={s.center}><Text style={s.emptyTitle}>SIN DEPENDENCIA ASIGNADA</Text><Text style={s.mutedCenter}>TU PERFIL NO TIENE MESA ASIGNADA. CONTACTA A UN ADMINISTRADOR.</Text></View>;
  }
  if (loading) return <View style={s.center}><ActivityIndicator color={theme.colors.primary}/><Text style={s.muted}>CARGANDO TICKETS…</Text></View>;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={s.kickerRow}><View style={s.kickerDot}/><Text style={s.kicker}>ADMINISTRADOR · MESA #{mesaId}</Text></View>
        <Text style={s.h1}>Mesas</Text>
        <Text style={s.subtitle}>TICKETS DE TU DEPENDENCIA (MESA {mesaId}). SOLO VES TICKETS DE TU DEPENDENCIA. ASIGNA A TÉCNICO DE LA MISMA DEPENDENCIA.</Text>
        {errorMsg? <Text style={s.error}>{errorMsg}</Text>:null}
      </View>
      <View style={s.filterCard}>
        <View style={s.searchWrap}><Text style={s.searchIcon}>⌕</Text><TextInput value={q} onChangeText={setQ} placeholder="Buscar por asunto" placeholderTextColor={theme.colors.mutedSoft} style={s.search}/>{!!q && <Pressable onPress={()=>setQ('')}><Text style={s.clearText}>×</Text></Pressable>}</View>
        <Pressable onPress={fetchTickets} style={s.btnPrimary}><Text style={s.btnPrimaryText}>BUSCAR</Text></Pressable>
      </View>
      <FlatList data={tickets} keyExtractor={t=>t.id} contentContainerStyle={s.listContent}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>SIN TICKETS</Text><Text style={s.mutedCenter}>NO HAY TICKETS PARA ESTA DEPENDENCIA.</Text></View>}
        renderItem={({item})=> (
          <Card style={s.card}>
            <View style={s.cardTop}><Text style={s.cardId}>#{item.numero} · {item.estado.toUpperCase()}</Text><Text style={s.priority}>{item.prioridad.toUpperCase()}</Text></View>
            <Text style={s.name} numberOfLines={2}>{item.asunto}</Text>
            <Text style={s.muted} numberOfLines={2}>{item.descripcion}</Text>
            <View style={s.actions}>
              <Text style={s.muted}>TÉCNICO: {item.tecnicoAsignadoId ?? 'SIN ASIGNAR'}</Text>
              <Pressable onPress={()=>openAssign(item)} style={s.btnGhost}><Text style={s.btnGhostText}>ASIGNAR TÉCNICO</Text></Pressable>
            </View>
          </Card>
        )}
      />
      <Modal visible={!!assignOpen} transparent animationType="fade" onRequestClose={()=>setAssignOpen(null)}>
        <View style={s.modalBackdrop}><View style={s.modalCard}>
          <Text style={s.modalTitle}>ASIGNAR TÉCNICO · #{assignOpen?.numero}</Text>
          <Text style={s.modalHint}>SOLO TÉCNICOS DE LA DEPENDENCIA {assignOpen?.mesaId}</Text>
          {tecnicos.length===0? <Text style={s.muted}>SIN TÉCNICOS EN ESTA DEPENDENCIA</Text>:
            tecnicos.map(t=> (
              <Pressable key={t.id} onPress={()=>setAssignId(t.id)} style={[s.techRow, assignId===t.id && s.techRowActive]}><Text style={s.techText}>{(t.full_name ?? t.email ?? t.id).toUpperCase()}</Text></Pressable>
            ))
          }
          <Pressable onPress={()=>setAssignId('')} style={[s.techRow, !assignId && s.techRowActive]}><Text style={s.techText}>SIN ASIGNAR</Text></Pressable>
          <View style={s.modalActions}>
            <Pressable onPress={()=>setAssignOpen(null)} style={s.btnGhost}><Text style={s.btnGhostText}>CANCELAR</Text></Pressable>
            <Pressable onPress={doAssign} disabled={assignLoading} style={[s.btnPrimary, assignLoading && {opacity:0.6}]}><Text style={s.btnPrimaryText}>{assignLoading?'GUARDANDO…':'GUARDAR'}</Text></Pressable>
          </View>
        </View></View>
      </Modal>
      {feedback? <FeedbackModal visible={feedback.visible} variant={feedback.variant as never} title={feedback.title} message={feedback.message} onClose={()=>setFeedback(null)} onConfirm={()=>setFeedback(null)}/>:null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:{flex:1, backgroundColor:theme.colors.bg},
  center:{flex:1, alignItems:'center', justifyContent:'center', gap:10, backgroundColor:theme.colors.bg, padding:24},
  muted:{color:theme.colors.muted, fontSize:12},
  mutedCenter:{color:theme.colors.muted, fontSize:12, textAlign:'center'},
  error:{color:theme.colors.danger, fontSize:11, fontWeight:'600', textTransform:'uppercase'},
  header:{paddingHorizontal:theme.space[4], paddingTop:theme.space[4], paddingBottom:theme.space[3], gap:8},
  kickerRow:{flexDirection:'row', alignItems:'center', gap:8},
  kickerDot:{width:6, height:6, borderRadius:999, backgroundColor:theme.colors.primary},
  kicker:{fontSize:10, fontWeight:'800', letterSpacing:1.1, color:theme.colors.muted, textTransform:'uppercase'},
  h1:{fontSize:22, fontWeight:'800', color:theme.colors.text, textTransform:'uppercase'},
  subtitle:{fontSize:12, color:theme.colors.muted, lineHeight:16, textTransform:'uppercase'},
  filterCard:{marginHorizontal:12, marginBottom:12, gap:12, backgroundColor:theme.colors.surface, borderRadius:theme.radius.lg, padding:16, borderWidth:1, borderColor:theme.colors.border},
  searchWrap:{flexDirection:'row', alignItems:'center', backgroundColor:theme.colors.surfaceAlt, borderWidth:1, borderColor:theme.colors.borderStrong, borderRadius:theme.radius.sm, paddingHorizontal:12, height:44},
  searchIcon:{color:theme.colors.mutedSoft, marginRight:8, fontSize:14},
  search:{flex:1, fontSize:13, color:theme.colors.text, textTransform:'uppercase'},
  clearText:{fontSize:18, color:theme.colors.muted, fontWeight:'600', padding:6},
  btnPrimary:{backgroundColor:theme.colors.primary, paddingHorizontal:16, height:40, borderRadius:theme.radius.sm, alignItems:'center', justifyContent:'center'},
  btnPrimaryText:{color:'#fff', fontWeight:'800', fontSize:12, textTransform:'uppercase'},
  listContent:{padding:12, gap:10, paddingBottom:24},
  card:{gap:8, flex:1},
  cardTop:{flexDirection:'row', justifyContent:'space-between'},
  cardId:{fontSize:10, fontWeight:'700', color:theme.colors.mutedSoft, textTransform:'uppercase'},
  priority:{fontSize:10, fontWeight:'800', color:theme.colors.primaryDark, textTransform:'uppercase'},
  name:{fontSize:14, fontWeight:'800', color:theme.colors.text, textTransform:'uppercase'},
  actions:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:4},
  btnGhost:{height:36, borderRadius:theme.radius.sm, borderWidth:1, borderColor:theme.colors.border, backgroundColor:theme.colors.surfaceAlt, alignItems:'center', justifyContent:'center', paddingHorizontal:12},
  btnGhostText:{fontSize:11, fontWeight:'700', color:theme.colors.text, textTransform:'uppercase'},
  empty:{alignItems:'center', padding:32, gap:10, backgroundColor:theme.colors.surface, borderRadius:theme.radius.lg, borderWidth:1, borderColor:theme.colors.border},
  emptyTitle:{fontSize:14, fontWeight:'700', color:theme.colors.text, textTransform:'uppercase'},
  modalBackdrop:{flex:1, backgroundColor:'rgba(15,23,42,0.45)', alignItems:'center', justifyContent:'center', padding:16},
  modalCard:{width:'100%', maxWidth:520, backgroundColor:theme.colors.surface, borderRadius:theme.radius.lg, padding:16, gap:12, borderWidth:1, borderColor:theme.colors.border},
  modalTitle:{fontSize:16, fontWeight:'800', color:theme.colors.text, textTransform:'uppercase'},
  modalHint:{fontSize:11, color:theme.colors.muted, textTransform:'uppercase'},
  techRow:{padding:10, borderWidth:1, borderColor:theme.colors.border, borderRadius:8, backgroundColor:theme.colors.surfaceAlt},
  techRowActive:{borderColor:theme.colors.primary, backgroundColor:theme.colors.primarySoft},
  techText:{fontSize:12, fontWeight:'700', color:theme.colors.text, textTransform:'uppercase'},
  modalActions:{flexDirection:'row', justifyContent:'flex-end', gap:10, marginTop:4},
});
