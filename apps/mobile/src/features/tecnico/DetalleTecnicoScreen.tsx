// RF-09/10/13/14/15 — Detalle Técnico (Stitch split 8+4, FSM naranja, SLA 35m)
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { addComentario, canTransition, fetchMesas, getTicketDetail, reassignTicket, transitionTicket, validateComentario, ESTADOS, type TicketDetail } from '@helpdesk/shared';
import { Badge, Card, Divider, theme, TicketCommentList, TicketCommentComposer } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Props = { route: { params: { id: string } }; navigation?: any };

const tonoEstado = (e: string) => {
  if (e === 'abierto') return 'muted' as const;
  if (e === 'en_proceso') return 'info' as const;
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

export function DetalleTecnicoScreen({ route }: Props) {
  const { id } = route.params;
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const { profile } = useAuth();
  const canComment = !!profile && ['usuario', 'tecnico', 'jefe'].includes(profile.rol);
  const canInternal = !!profile && ['tecnico', 'jefe', 'administrador'].includes(profile.rol);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [interno, setInterno] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showTrans, setShowTrans] = useState(false);
  const [solucion, setSolucion] = useState('');
  const [transLoading, setTransLoading] = useState<string | null>(null);
  const [transError, setTransError] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignTecnico, setReassignTecnico] = useState('');
  const [reassignMesa, setReassignMesa] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'comentarios' | 'historial' | 'archivos'>('comentarios');
  const [mesaNombre, setMesaNombre] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getTicketDetail(supabase, id);
      setDetail(d);
      try { const ms = await fetchMesas(supabase); const m = ms.find((x) => x.id === d.ticket.mesaId); if (m) setMesaNombre(m.nombre); } catch {}
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`ticket-tecnico-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_estados', filter: `ticket_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comentarios', filter: `ticket_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_adjuntos', filter: `ticket_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  const onSend = async () => {
    const v = validateComentario(mensaje);
    if (v) { setSendError(v); return; }
    if (!canComment) { setSendError('No autorizado para comentar'); return; }
    if (interno && !canInternal) { setSendError('Solo técnico/jefe pueden marcar interno'); return; }
    setSending(true); setSendError(null);
    try { await addComentario(supabase, id, mensaje, { interno: canInternal ? interno : false }); setMensaje(''); setInterno(false); await load(); }
    catch (e) { setSendError(e instanceof Error ? e.message : String(e)); } finally { setSending(false); }
  };
  const onTransition = async (estado: string) => {
    if ((estado === 'solucionado' || estado === 'cerrado') && solucion.trim().length < 5) {
      setTransError('Describe la solución aplicada (mín. 5 caracteres) — requerida para ' + estado);
      return;
    }
    setTransLoading(estado); setTransError(null);
    try { await transitionTicket(supabase, id, estado as any, { solucionAplicada: solucion || undefined }); setShowTrans(false); setSolucion(''); await load(); }
    catch (e) { setTransError(e instanceof Error ? e.message : String(e)); } finally { setTransLoading(null); }
  };
  const onReassign = async () => {
    setReassignLoading(true); setReassignError(null);
    try {
      const patch: any = {};
      if (reassignTecnico.trim()) patch.tecnicoId = reassignTecnico.trim() === 'null' ? null : reassignTecnico.trim();
      if (reassignMesa.trim()) patch.mesaId = reassignMesa.trim() === 'null' ? null : Number(reassignMesa.trim());
      if (!Object.keys(patch).length) { setReassignError('Ingresa técnico UUID o mesa ID'); return; }
      await reassignTicket(supabase, id, patch); setShowReassign(false); setReassignTecnico(''); setReassignMesa(''); await load();
    } catch (e) { setReassignError(e instanceof Error ? e.message : String(e)); } finally { setReassignLoading(false); }
  };

  if (loading && !detail) return <View style={s.center}><View style={s.loadingDot} /><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando expediente técnico…</Text></View>;
  if (error) return <View style={s.center}><Card><Text style={s.error}>{error}</Text><Pressable onPress={load} style={s.retryBtn}><Text style={s.retryText}>Reintentar</Text></Pressable></Card></View>;
  if (!detail) return <View style={s.center}><Text style={s.muted}>Sin datos</Text></View>;

  const { ticket, estados, comentarios, adjuntos = [] } = detail;
  const onOpenAdjunto = async (a: { storagePath: string }) => {
    try {
      const { data } = await supabase.storage.from('ticket-adjuntos').createSignedUrl(a.storagePath, 60);
      const url = data?.signedUrl ?? supabase.storage.from('ticket-adjuntos').getPublicUrl(a.storagePath).data.publicUrl;
      if (url) await Linking.openURL(url);
    } catch {}
  };
  const isTecnicoLike = profile && ['tecnico','jefe','administrador'].includes(profile.rol);
  const isJefeAdmin = profile && ['jefe','administrador'].includes(profile.rol);
  const canReassign = !!isJefeAdmin || (!!isTecnicoLike && ticket.tecnicoAsignadoId === profile?.id);
  const nextEstados = ESTADOS.filter((e) => canTransition(ticket.estado as any, e as any));
  const slaPct = ticket.estado === 'cerrado' || ticket.estado === 'solucionado' ? 100 : ticket.prioridad === 'critica' ? 25 : ticket.prioridad === 'alta' ? 55 : 75;

  const header = (
    <View style={s.header}>
      <View style={s.kickerRow}><View style={s.kickerDot} /><Text style={s.kicker}>Expediente técnico · #{String(ticket.numero).padStart(4, '0')}</Text></View>
      <View style={s.pillsRow}>
        <View style={s.codePill}><Text style={s.codePillText}>#{String(ticket.numero).padStart(4, '0')}</Text></View>
        <Badge label={ticket.prioridad} tone={tonoPrioridad(ticket.prioridad)} />
        <Badge label={ticket.estado} tone={tonoEstado(ticket.estado)} />
        <View style={s.slaBadge}><View style={s.slaPulse} /><Text style={s.slaBadgeText}>SLA Activo</Text></View>
      </View>
      <Text style={s.asunto}>{ticket.asunto}</Text>
      <Text style={s.meta}>{mesaNombre || `Mesa ${ticket.mesaId ?? '—'}`} · Cat {ticket.categoriaId} · Reportado {new Date(ticket.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · Asignado a mí</Text>
    </View>
  );

  const left = (
    <View style={{ gap: theme.space[3], flex: isWide ? 8 : undefined }}>>
      <Card style={{ gap: theme.space[3] }}>>
        <Text style={s.section}>Descripción del usuario</Text>
        <Text style={s.desc}>{ticket.descripcion}</Text>
        <View style={s.terminal}><Text style={s.terminalText}>Ticket #{String(ticket.numero).padStart(4, '0')} · {ticket.estado} · Prioridad {ticket.prioridad} · Técnico {ticket.tecnicoAsignadoId?.slice(0,8) ?? '—'}</Text></View>
        {(ticket.solucionAplicada || ticket.fechaResolucion) ? (
          <View style={s.solBox}>
            <Text style={s.solLabel}>Solución aplicada{ticket.fechaResolucion ? ` · Resuelto ${new Date(ticket.fechaResolucion).toLocaleString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}` : ''}</Text>
            {ticket.solucionAplicada ? <Text style={s.solText}>{ticket.solucionAplicada}</Text> : <Text style={s.solTextMuted}>Sin detalle de solución — registra el procedimiento aplicado.</Text>}
          </View>
        ) : null}
      </Card>
      <Card style={{ gap: 0, padding: 0, overflow: 'hidden' } as any}>
        <View style={s.tabs}>
          {(['comentarios','historial','archivos'] as const).map((t) => (
            <Pressable key={t} onPress={() => setActiveTab(t)} style={[s.tab, activeTab===t && s.tabActive]} accessibilityRole="button" accessibilityState={{ selected: activeTab===t }}>
              <Text style={[s.tabText, activeTab===t && s.tabTextActive]}>{t==='comentarios'?`Comentarios (${comentarios.length})`:t==='historial'?`Historial (${estados.length})`:`Archivos (${adjuntos.length})`}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ padding: theme.space[4] - 2, gap: theme.space[3] - 2 }}>>
          {activeTab==='comentarios' ? <TicketCommentList comentarios={comentarios} /> : activeTab==='historial' ? (estados.length===0? <Text style={s.muted}>Sin cambios de estado aún</Text> : estados.map((e)=>(
            <View key={e.id} style={s.timelineRow}><View style={s.dotCol}><View style={s.dot} /><View style={s.line} /></View><View style={s.timelineBody}><Text style={s.rowTitle}>{e.tipoEvento==='estado'?`${e.estadoAnterior ?? '—'} → ${e.estadoNuevo ?? '—'}`:`Asignación ${e.tecnicoDe?.slice(0,6) ?? '—'} → ${e.tecnicoPara?.slice(0,6) ?? '—'}`}</Text><Text style={s.mutedSmall}>{new Date(e.creadoEn).toLocaleString('es-ES')}</Text>{e.comentario? <Text style={s.metaSmall}>{e.comentario}</Text> : null}</View></View>
          ))) : adjuntos.length === 0 ? (
            <View style={s.emptyFiles}><Text style={s.muted}>Sin archivos adjuntos.</Text></View>
          ) : (
            <View style={{ gap: 8 }}>
              {adjuntos.map((a) => (
                <Pressable key={a.id} onPress={() => onOpenAdjunto(a)} style={s.adjRow}>
                  <Image source={{ uri: supabase.storage.from('ticket-adjuntos').getPublicUrl(a.storagePath).data.publicUrl }} style={s.adjThumb} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.adjName}>{a.nombre}</Text>
                    <Text style={s.mutedSmall}>{(a.size / 1024).toFixed(0)} KB · {a.mime}</Text>
                  </View>
                  <Text style={s.adjLink}>Ver</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Card>
      <View style={s.composer}>
        <TicketCommentComposer mensaje={mensaje} onChange={setMensaje} interno={interno} onInternoChange={setInterno} canInternal={canInternal} sending={sending} error={sendError} onSend={onSend} canComment={canComment} label="Agregar avance técnico" />
      </View>
    </View>
  );

  const right = (
    <View style={{ gap: theme.space[3], flex: isWide ? 4 : undefined }}>>
      <Card style={{ gap: theme.space[3] - 2 }}>>
        <Text style={s.section}>Acciones de campo</Text>
        <Pressable onPress={()=>setShowTrans(v=>!v)} style={[s.btn, s.btnAccent]} accessibilityRole="button"><Text style={s.btnAccentText}>{showTrans?'Ocultar transición':'Solucionar incidente'}</Text></Pressable>
        {showTrans && nextEstados.length>0 ? (
          <View style={{ gap: 8 }}>
            <TextInput value={solucion} onChangeText={setSolucion} placeholder="Describe la solución (requerida para solucionado)" style={s.input} multiline maxLength={5000} />
            {transError ? <Text style={s.error}>{transError}</Text> : null}
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap: theme.space[2] }}>>
              {nextEstados.map((e)=>(
                <Pressable key={e} onPress={()=>onTransition(e)} disabled={!!transLoading} style={[s.btn, s.btnGhost, { paddingHorizontal:12, paddingVertical:8 }]}>
                  {transLoading===e? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={s.btnGhostText}>{e}</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View style={s.ghostStack}>
          <Pressable onPress={()=> Alert.alert('Escalar','Escalado a Infra N3 — próximamente')} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>Escalar a Infra N3</Text></Pressable>
          <Pressable onPress={()=> setShowTrans(true)} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>Requerir información</Text></Pressable>
          {canReassign ? <Pressable onPress={()=>setShowReassign(v=>!v)} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>{showReassign?'Ocultar reasignar':'Reasignar'}</Text></Pressable> : null}
        </View>
        {showReassign ? (
          <View style={{ gap: 8 }}>
            <TextInput value={reassignTecnico} onChangeText={setReassignTecnico} placeholder="UUID técnico (o 'null' para desasignar)" style={s.input} autoCapitalize="none" />
            <TextInput value={reassignMesa} onChangeText={setReassignMesa} placeholder="ID mesa (número)" style={s.input} keyboardType="numeric" />
            {reassignError ? <Text style={s.error}>{reassignError}</Text> : null}
            <Pressable onPress={onReassign} disabled={reassignLoading} style={[s.btn, s.btnPrimary, reassignLoading && {opacity:0.6} as any]}><Text style={s.btnPrimaryText}>{reassignLoading?'Reasignando…':'Confirmar reasignación'}</Text></Pressable>
          </View>
        ) : null}
      </Card>
      <Card style={{ gap: theme.space[3] - 2 }}>>
        <Text style={s.section}>Progreso del ticket</Text>
        <View style={s.progressWrap}>
          {[
            { label: 'Ticket creado', done: true },
            { label: 'Asignado a técnico', done: !!ticket.tecnicoAsignadoId },
            { label: 'En diagnóstico', done: ticket.estado==='en_proceso', pulse: ticket.estado==='en_proceso' },
            { label: 'Solución propuesta', done: ticket.estado==='solucionado' },
            { label: 'Cierre CSAT', done: ticket.estado==='cerrado' },
          ].map((n)=>(
            <View key={n.label} style={s.progressRow}><View style={s.progressDotCol}><View style={[s.progressDot, n.done? s.progressDotDone : s.progressDotTodo, (n as any).pulse && s.progressDotPulse]} /><View style={s.progressLine} /></View><View style={{flex:1}}><Text style={[s.progressLabel, !n.done && {color: theme.colors.mutedSoft} as any]}>{n.label}</Text></View></View>
          ))}
        </View>
      </Card>
      <Card style={{ gap: theme.space[2] }}>>
        <Text style={s.section}>Control SLA</Text>
        <Text style={s.slaBig}>{ticket.estado==='cerrado'||ticket.estado==='solucionado'?'Cumplido':'35 min restantes'}</Text>
        <View style={s.slaBar}><View style={[s.slaFill, { width: `${slaPct}%`, backgroundColor: ticket.estado==='solucionado'||ticket.estado==='cerrado'? theme.colors.success : ticket.prioridad==='critica'? theme.colors.danger : theme.colors.primary }]} /></View>
        <View style={s.slaAlert}><Text style={s.slaAlertText}>{ticket.prioridad==='critica'?'Crítico <60 min · Riesgo alto': ticket.prioridad==='alta'?'Alta <4h · vigilar':'Dentro de compromiso'}</Text></View>
        <View style={s.attrGrid}>
          <Text style={s.attrLabel}>Prioridad</Text><Text style={s.attrValue}>{ticket.prioridad}</Text>
          <Text style={s.attrLabel}>Estado</Text><Text style={s.attrValue}>{ticket.estado}</Text>
          <Text style={s.attrLabel}>Dependencia</Text><Text style={s.attrValue}>{mesaNombre || String(ticket.mesaId)}</Text>
          <Text style={s.attrLabel}>Asignado</Text><Text style={s.attrValue}>{ticket.tecnicoAsignadoId? ticket.tecnicoAsignadoId.slice(0,8)+'…' : 'Sin asignar'}</Text>
        </View>
      </Card>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={s.container} style={{ backgroundColor: theme.colors.bg }}>
      {header}
      <View style={[isWide ? { flexDirection:'row', gap: theme.space[4], alignItems:'flex-start' } : { gap: theme.space[3] }]}>
        {left}{right}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems:'center', justifyContent:'center', gap: 10, padding: 24, backgroundColor: theme.colors.bg },
  loadingDot: { width: 36, height:3, borderRadius:999, backgroundColor: theme.colors.primary, opacity:0.9 },
  muted: { color: theme.colors.muted, fontSize:12, lineHeight:16 },
  mutedSmall: { color: theme.colors.mutedSoft, fontSize:11 },
  metaSmall: { fontSize:11, color: theme.colors.textSoft, marginTop:4 },
  error: { color: theme.colors.danger, fontSize:12, fontWeight:'600' },
  errorBox: { backgroundColor:'#FDF1F0', borderWidth:1, borderColor:'#F4C7C3', borderRadius:12, padding:10 },
  container: { padding: theme.space[4], gap: theme.space[4], paddingBottom: theme.space[6] + 4 }, // 16/16/28 — tokens
  header: { gap: theme.space[3] - 2, paddingHorizontal: theme.space[1] - 2 }, // 10/2
  kickerRow: { flexDirection:'row', alignItems:'center', gap: theme.space[2] }, // 8
  kickerDot: { width:4, height:4, borderRadius:999, backgroundColor: theme.colors.primary },
  kicker: { fontSize:10, fontWeight:'800', letterSpacing:1.2, color: theme.colors.muted, textTransform:'uppercase' },
  pillsRow: { flexDirection:'row', alignItems:'center', gap: theme.space[2], flexWrap:'wrap' }, // 8
  codePill: { backgroundColor: theme.colors.surfaceAlt, borderWidth:1, borderColor: theme.colors.border, paddingHorizontal: theme.space[2], paddingVertical: theme.space[1], borderRadius: theme.space[2] }, // 8/4/8
  codePillText: { fontSize:11, fontWeight:'800', color: theme.colors.text, fontFamily: theme.font.mono },
  slaBadge: { flexDirection:'row', alignItems:'center', gap: theme.space[2] - 2, backgroundColor:'#FEF2F2', borderWidth:1, borderColor:'#FECACA', paddingHorizontal: theme.space[2], paddingVertical: theme.space[1], borderRadius: theme.radius.full },
  slaBadgeText: { fontSize:10, fontWeight:'800', color:'#991B1B', textTransform:'uppercase', letterSpacing:0.6 },
  slaPulse: { width:6, height:6, borderRadius:999, backgroundColor: theme.colors.danger },
  asunto: { fontSize:20, fontWeight:'800', color: theme.colors.text, lineHeight:26, letterSpacing:-0.3 },
  meta: { fontSize:11, color: theme.colors.muted, fontWeight:'600' },
  desc: { fontSize:13, color: theme.colors.textSoft, lineHeight:19 },
  section: { fontSize:11, fontWeight:'800', letterSpacing:0.8, textTransform:'uppercase', color: theme.colors.text, marginBottom:2 },
  tabs: { flexDirection:'row', borderBottomWidth:1, borderBottomColor: theme.colors.border },
  tab: { flex:1, paddingVertical:12, alignItems:'center', borderBottomWidth:2, borderBottomColor:'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize:11, fontWeight:'700', color: theme.colors.muted },
  tabTextActive: { color: theme.colors.primary },
  comment: { gap:6, paddingVertical:10, borderBottomWidth:1, borderBottomColor: theme.colors.border, borderStyle:'dashed' },
  commentInternal: { backgroundColor:'#FFF7ED', borderWidth:1, borderColor:'#FED7AA', borderRadius:12, padding:10, borderStyle:'solid' },
  rowHeader: { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  rowTitle: { fontSize:12, fontWeight:'700', color: theme.colors.text },
  composer: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.space[4] - 2, borderWidth:1, borderColor: theme.colors.border, gap: theme.space[3] - 2, ...theme.shadow.soft },
  input: { borderWidth:1, borderColor: theme.colors.border, borderRadius: theme.radius.md - 2, paddingHorizontal: theme.space[3], paddingVertical: theme.space[3], fontSize:13, color: theme.colors.text, minHeight:44, textAlignVertical:'top', backgroundColor: theme.colors.surfaceAlt },
  timelineRow: { flexDirection:'row', gap: theme.space[3] - 2, paddingVertical: theme.space[2] - 2 }, // 10/6
  dotCol: { alignItems:'center', width:12 },
  dot: { width:8, height:8, borderRadius:999, backgroundColor: theme.colors.primary, marginTop:4 },
  line: { flex:1, width:1, backgroundColor: theme.colors.border, marginTop:6, opacity:0.8 },
  timelineBody: { flex:1, gap:2, paddingBottom:8, borderBottomWidth:1, borderBottomColor: theme.colors.border },
  hint: { fontSize:10, color: theme.colors.mutedSoft, textAlign:'right' },
  switchRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor: theme.colors.bg, borderRadius: theme.radius.md - 2, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2], borderWidth:1, borderColor: theme.colors.border },
  switchLabel: { fontSize:12, color: theme.colors.primary, fontWeight:'600' },
  sendBtn: { backgroundColor: theme.colors.primary, paddingVertical: theme.space[3] + 1, borderRadius: theme.radius.md - 2, alignItems:'center' },
  sendText: { color:'#fff', fontWeight:'800', fontSize:13 },
  btn: { paddingVertical: theme.space[3] - 2, paddingHorizontal: theme.space[4], borderRadius: theme.radius.sm, alignItems:'center', justifyContent:'center' }, // 10/16/10
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnPrimaryText: { color:'#fff', fontWeight:'700', fontSize:12 },
  btnAccent: { backgroundColor: theme.colors.accent, borderWidth:1, borderColor:'#FED7AA' },
  btnAccentText: { color:'#fff', fontWeight:'800', fontSize:12 },
  btnGhost: { backgroundColor: theme.colors.surface, borderWidth:1, borderColor: theme.colors.border },
  btnGhostText: { color: theme.colors.textSoft, fontWeight:'700', fontSize:12 },
  actionRow: { flexDirection:'row', gap: theme.space[2], flexWrap:'wrap' },
  retryBtn: { marginTop: theme.space[3] - 2, backgroundColor: theme.colors.primary, paddingVertical: theme.space[3] - 2, paddingHorizontal: theme.space[4], borderRadius: theme.radius.md - 2, alignSelf:'flex-start' },
  retryText: { color:'#fff', fontWeight:'700', fontSize:12 },
  terminal: { backgroundColor: theme.colors.text, borderRadius: theme.radius.sm, padding: theme.space[3] },
  terminalText: { color:'#A7F3D0', fontSize:11, fontFamily: theme.font.mono, fontWeight:'600' },
  solBox: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: theme.space[3] - 2, borderWidth:1, borderColor: theme.colors.border, gap: theme.space[1] }, // 10/10/4
  solLabel: { fontSize:10, fontWeight:'800', letterSpacing:0.6, textTransform:'uppercase', color: theme.colors.primary },
  solText: { fontSize:12, color: theme.colors.textSoft, lineHeight:16 },
  solTextMuted: { fontSize:12, color: theme.colors.mutedSoft, lineHeight:16, fontStyle:'italic' },
  ghostStack: { gap: theme.space[2], marginTop: theme.space[1] }, // 8/4
  progressWrap: { gap:2, paddingLeft:6 },
  progressRow: { flexDirection:'row', gap: theme.space[3] - 2, paddingVertical: theme.space[2] - 2 }, // 10/6
  progressDotCol: { alignItems:'center', width:12 },
  progressDot: { width:10, height:10, borderRadius:999, borderWidth:2, marginTop:2 },
  progressDotDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  progressDotTodo: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
  progressDotPulse: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  progressLine: { flex:1, width:1, backgroundColor: theme.colors.border, marginTop:4, opacity:0.6 },
  progressLabel: { fontSize:12, fontWeight:'700', color: theme.colors.text },
  emptyFiles: { alignItems:'center', padding: theme.space[3] },
  slaBig: { fontSize:18, fontWeight:'800', color: theme.colors.danger, letterSpacing:-0.3 },
  slaBar: { height:8, borderRadius:999, backgroundColor: theme.colors.surfaceAlt, borderWidth:1, borderColor: theme.colors.border, overflow:'hidden' },
  slaFill: { height:'100%', borderRadius:999 },
  slaAlert: { backgroundColor:'#FEF2F2', borderWidth:1, borderColor:'#FECACA', borderRadius: theme.radius.sm, padding: theme.space[2] },
  slaAlertText: { fontSize:11, color:'#7F1D1D', fontWeight:'600', textAlign:'center' },
  attrGrid: { flexDirection:'row', flexWrap:'wrap', gap: theme.space[2] - 2, marginTop: theme.space[1], borderTopWidth:1, borderTopColor: theme.colors.border, paddingTop: theme.space[2] }, // 6/4/8
  attrLabel: { fontSize:10, color: theme.colors.mutedSoft, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.6, width:90 },
  attrValue: { fontSize:11, color: theme.colors.textSoft, fontWeight:'600', flex:1 },
  adjRow: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor: theme.colors.surfaceAlt, borderWidth:1, borderColor: theme.colors.border, borderRadius:10, padding:8 },
  adjThumb: { width:56, height:56, borderRadius:8, backgroundColor: theme.colors.border } as any,
  adjName: { fontSize:12, fontWeight:'700', color: theme.colors.text, flex:1 },
  adjLink: { fontSize:11, fontWeight:'800', color: theme.colors.primary },
});
