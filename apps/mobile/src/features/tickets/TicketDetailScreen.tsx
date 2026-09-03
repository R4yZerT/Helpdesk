// RF-09/10/11/13/14/15 — Detalle con edición, cancelación, transiciones, reasignación y comentarios
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { addComentario, canTransition, cancelTicket, getTicketDetail, reassignTicket, transitionTicket, updateTicket, validateComentario, validateUpdateTicket, ESTADOS, type TicketDetail } from '@helpdesk/shared';
import { Badge, Card, Divider, theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Props = { route: { params: { id: string } } };

const tonoEstado = (e: string) => {
  if (e === 'abierto') return 'warning' as const;
  if (e === 'en_proceso') return 'accent' as const;
  if (e === 'solucionado' || e === 'cerrado') return 'success' as const;
  if (e === 'devuelto') return 'danger' as const;
  return 'muted' as const;
};
const tonoPrioridad = (p: string) => {
  if (p === 'critica') return 'danger' as const;
  if (p === 'alta') return 'warning' as const;
  if (p === 'media') return 'accent' as const;
  return 'muted' as const;
};

export function TicketDetailScreen({ route }: Props) {
  const { id } = route.params;
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
  // RF-10 edición
  const [editing, setEditing] = useState(false);
  const [editAsunto, setEditAsunto] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // RF-13 transición
  const [showTrans, setShowTrans] = useState(false);
  const [solucion, setSolucion] = useState('');
  const [transLoading, setTransLoading] = useState<string | null>(null);
  const [transError, setTransError] = useState<string | null>(null);
  // RF-14 reasignar
  const [showReassign, setShowReassign] = useState(false);
  const [reassignTecnico, setReassignTecnico] = useState('');
  const [reassignMesa, setReassignMesa] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getTicketDetail(supabase, id);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`ticket-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_estados', filter: `ticket_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comentarios', filter: `ticket_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  const onSend = async () => {
    const v = validateComentario(mensaje);
    if (v) { setSendError(v); return; }
    if (!canComment) { setSendError('No autorizado para comentar'); return; }
    if (interno && !canInternal) { setSendError('Solo técnico/jefe pueden marcar interno'); return; }
    setSending(true);
    setSendError(null);
    try {
      await addComentario(supabase, id, mensaje, { interno: canInternal ? interno : false });
      setMensaje('');
      setInterno(false);
      await load();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const startEdit = () => {
    if (!detail) return;
    setEditAsunto(detail.ticket.asunto);
    setEditDesc(detail.ticket.descripcion);
    setEditing(true);
    setEditError(null);
  };
  const onSaveEdit = async () => {
    const v = validateUpdateTicket({ asunto: editAsunto, descripcion: editDesc });
    if (Object.keys(v).length) { setEditError(Object.values(v)[0]!); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      await updateTicket(supabase, id, { asunto: editAsunto, descripcion: editDesc });
      setEditing(false);
      await load();
    } catch (e) { setEditError(e instanceof Error ? e.message : String(e)); } finally { setEditSaving(false); }
  };
  const onCancelTicket = () => {
    Alert.alert('Cancelar solicitud', '¿Seguro que quieres cerrar esta solicitud?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cerrar', style: 'destructive', onPress: async () => {
        try { await cancelTicket(supabase, id); await load(); } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : String(e)); }
      }},
    ]);
  };
  const onTransition = async (estado: string) => {
    setTransLoading(estado);
    setTransError(null);
    try {
      await transitionTicket(supabase, id, estado as any, { solucionAplicada: solucion || undefined });
      setShowTrans(false);
      setSolucion('');
      await load();
    } catch (e) { setTransError(e instanceof Error ? e.message : String(e)); } finally { setTransLoading(null); }
  };
  const onReassign = async () => {
    setReassignLoading(true);
    setReassignError(null);
    try {
      const patch: any = {};
      if (reassignTecnico.trim()) patch.tecnicoId = reassignTecnico.trim() === 'null' ? null : reassignTecnico.trim();
      if (reassignMesa.trim()) patch.mesaId = reassignMesa.trim() === 'null' ? null : Number(reassignMesa.trim());
      if (!Object.keys(patch).length) { setReassignError('Ingresa técnico UUID o mesa ID'); return; }
      await reassignTicket(supabase, id, patch);
      setShowReassign(false);
      setReassignTecnico('');
      setReassignMesa('');
      await load();
    } catch (e) { setReassignError(e instanceof Error ? e.message : String(e)); } finally { setReassignLoading(false); }
  };

  if (loading && !detail) {
    return <View style={s.center}><View style={s.loadingDot} /><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando expediente…</Text></View>;
  }
  if (error) {
    return <View style={s.center}><Card><Text style={s.error}>{error}</Text><Pressable onPress={load} style={s.retryBtn}><Text style={s.retryText}>Reintentar</Text></Pressable></Card></View>;
  }
  if (!detail) return <View style={s.center}><Text style={s.muted}>Sin datos</Text></View>;

  const { ticket, estados, comentarios } = detail;
  const isOwner = profile?.id === ticket.usuarioId;
  const canEdit = isOwner && ticket.estado === 'abierto' && !ticket.tecnicoAsignadoId;
  const canCancel = canEdit;
  const isTecnicoLike = profile && ['tecnico','jefe','administrador'].includes(profile.rol);
  const isJefeAdmin = profile && ['jefe','administrador'].includes(profile.rol);
  const canReassign = !!isJefeAdmin || (!!isTecnicoLike && ticket.tecnicoAsignadoId === profile?.id);
  const nextEstados = ESTADOS.filter((e) => canTransition(ticket.estado as any, e as any));
  const charCount = mensaje.length;

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" style={{ backgroundColor: theme.colors.bg }}>
      {/* Hero expediente */}
      <View style={s.hero}>
        <View style={s.kickerRow}><View style={s.kickerHairline} /><Text style={s.kicker}>Expediente  ·  #{String(ticket.numero).padStart(4, '0')}</Text></View>
        {editing ? (
          <>
            <TextInput value={editAsunto} onChangeText={setEditAsunto} style={s.editInput} placeholder="Asunto (5-200)" maxLength={200} />
            <TextInput value={editDesc} onChangeText={setEditDesc} style={[s.editInput, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Descripción (10-5000)" multiline maxLength={5000} />
            {editError ? <Text style={s.error}>{editError}</Text> : null}
            <View style={s.actionRow}>
              <Pressable onPress={() => setEditing(false)} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
              <Pressable onPress={onSaveEdit} disabled={editSaving} style={[s.btn, s.btnPrimary, editSaving && { opacity: 0.6 }]}>{editSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Guardar</Text>}</Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={s.asunto}>{ticket.asunto}</Text>
            <Text style={s.desc}>{ticket.descripcion}</Text>
          </>
        )}
        <View style={s.badges}><Badge label={ticket.estado} tone={tonoEstado(ticket.estado)} /><Badge label={ticket.prioridad} tone={tonoPrioridad(ticket.prioridad)} /></View>
        <Divider />
        <View style={s.metaGrid}>
          <Text style={s.meta}>Creado {new Date(ticket.creadoEn).toLocaleString('es-ES')}</Text>
          <Text style={s.metaDot}>·</Text>
          <Text style={s.meta}>Mesa {ticket.mesaId ?? '—'}  ·  Cat {ticket.categoriaId}</Text>
        </View>
        {ticket.tecnicoAsignadoId ? <Text style={s.metaSoft}>Técnico {ticket.tecnicoAsignadoId.slice(0, 8)}…</Text> : <Text style={s.metaSoft}>Sin técnico asignado</Text>}
        {ticket.solucionAplicada ? <View style={s.solBox}><Text style={s.solLabel}>Solución aplicada</Text><Text style={s.solText}>{ticket.solucionAplicada}</Text></View> : null}
        {ticket.fechaResolucion ? <Text style={s.metaSoft}>Resuelto {new Date(ticket.fechaResolucion).toLocaleString('es-ES')}</Text> : null}
      </View>

      {/* Acciones RF-10/13/14 */}
      <Card>
        <Text style={s.section}>Acciones</Text>
        {canEdit && !editing ? (
          <View style={s.actionRow}>
            <Pressable onPress={startEdit} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>Editar</Text></Pressable>
            <Pressable onPress={onCancelTicket} style={[s.btn, s.btnDanger]}><Text style={s.btnDangerText}>Cancelar solicitud</Text></Pressable>
          </View>
        ) : null}
        {nextEstados.length > 0 && isTecnicoLike ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Pressable onPress={() => setShowTrans((v) => !v)} style={[s.btn, s.btnPrimary]}><Text style={s.btnPrimaryText}>{showTrans ? 'Ocultar transiciones' : 'Cambiar estado'}</Text></Pressable>
            {showTrans ? (
              <View style={{ gap: 8 }}>
                <Text style={s.mutedSmall}>Solución (opcional, se guarda al pasar a solucionado/cerrado):</Text>
                <TextInput value={solucion} onChangeText={setSolucion} placeholder="Describe la solución…" style={s.input} multiline maxLength={5000} />
                {transError ? <Text style={s.error}>{transError}</Text> : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {nextEstados.map((e) => (
                    <Pressable key={e} onPress={() => onTransition(e)} disabled={!!transLoading} style={[s.btn, s.btnGhost, { paddingHorizontal: 12, paddingVertical: 8 }]}>
                      {transLoading === e ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Text style={s.btnGhostText}>{e}</Text>}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        {canReassign ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Pressable onPress={() => setShowReassign((v) => !v)} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>{showReassign ? 'Ocultar reasignar' : 'Reasignar…'}</Text></Pressable>
            {showReassign ? (
              <View style={{ gap: 8 }}>
                <TextInput value={reassignTecnico} onChangeText={setReassignTecnico} placeholder="UUID técnico (o 'null' para desasignar)" style={s.input} autoCapitalize="none" />
                <TextInput value={reassignMesa} onChangeText={setReassignMesa} placeholder="ID mesa (número)" style={s.input} keyboardType="numeric" />
                {reassignError ? <Text style={s.error}>{reassignError}</Text> : null}
                <Pressable onPress={onReassign} disabled={reassignLoading} style={[s.btn, s.btnPrimary, reassignLoading && { opacity: 0.6 }]}>{reassignLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Confirmar reasignación</Text>}</Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
        {!canEdit && nextEstados.length === 0 && !canReassign ? <Text style={s.muted}>Sin acciones disponibles para tu rol/estado</Text> : null}
      </Card>

      <Card>
        <Text style={s.section}>Historial  ·  {estados.length}</Text>
        {estados.length === 0 ? <Text style={s.muted}>Sin cambios de estado aún</Text> : estados.map((e) => (
          <View key={e.id} style={s.timelineRow}>
            <View style={s.dotCol}><View style={s.dot} /><View style={s.line} /></View>
            <View style={s.timelineBody}>
              <Text style={s.rowTitle}>{e.tipoEvento === 'estado' ? `${e.estadoAnterior ?? '—'} → ${e.estadoNuevo ?? '—'}` : `Asignación ${e.tecnicoDe?.slice(0, 6) ?? '—'} → ${e.tecnicoPara?.slice(0, 6) ?? '—'}`}</Text>
              <Text style={s.mutedSmall}>{new Date(e.creadoEn).toLocaleString('es-ES')}</Text>
              {e.comentario ? <Text style={s.metaSmall}>{e.comentario}</Text> : null}
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.section}>Conversación  ·  {comentarios.length}</Text>
        {comentarios.length === 0 ? <Text style={s.muted}>Sin comentarios — inicia el hilo con tu avance.</Text> : comentarios.map((c) => (
          <View key={c.id} style={s.comment}>
            <View style={s.rowHeader}>
              <Text style={s.rowTitle}>{c.usuarioId.slice(0, 8)}…</Text>
              {c.interno ? <Badge label="interno" tone="accent" /> : null}
              <Text style={s.mutedSmall}>{new Date(c.creadoEn).toLocaleDateString('es-ES')}</Text>
            </View>
            <Text style={s.desc}>{c.comentario}</Text>
          </View>
        ))}
      </Card>

      {/* Composer */}
      <View style={s.composer} accessibilityRole="none" accessibilityLabel="Agregar comentario">
        <Text style={s.section}>Agregar avance</Text>
        {!canComment ? <Text style={s.muted}>No tienes permiso para comentar en este ticket</Text> : (
          <>
            <TextInput
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Escribe tu avance…"
              placeholderTextColor={theme.colors.mutedSoft}
              style={s.input}
              multiline
              numberOfLines={3}
              maxLength={2000}
              accessibilityLabel="Mensaje del comentario"
              editable={!sending}
            />
            <Text style={[s.hint, charCount > 1800 && { color: theme.colors.warning }]}>{charCount}/2000</Text>
            {canInternal ? (
              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Interno — solo equipo</Text>
                <Switch value={interno} onValueChange={setInterno} disabled={sending} trackColor={{ true: theme.colors.accent }} thumbColor="#fff" accessibilityLabel="Marcar como interno" />
              </View>
            ) : null}
            {sendError ? <View style={s.errorBox}><Text style={s.error} accessibilityRole="alert">{sendError}</Text></View> : null}
            <Pressable
              onPress={onSend}
              disabled={sending || !mensaje.trim()}
              style={[s.sendBtn, (sending || !mensaje.trim()) && { opacity: 0.45 }]}
              accessibilityRole="button"
              accessibilityLabel="Enviar comentario"
              accessibilityState={{ disabled: sending || !mensaje.trim() }}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.sendText}>Enviar avance</Text>}
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: theme.colors.bg },
  loadingDot: { width: 36, height: 3, borderRadius: 999, backgroundColor: theme.colors.accent, opacity: 0.9 },
  muted: { color: theme.colors.muted, fontSize: 12, lineHeight: 16 },
  mutedSmall: { color: theme.colors.mutedSoft, fontSize: 11 },
  metaSmall: { fontSize: 11, color: theme.colors.textSoft, marginTop: 4 },
  error: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
  errorBox: { backgroundColor: '#FDF1F0', borderWidth: 1, borderColor: '#F4C7C3', borderRadius: 12, padding: 10 },
  container: { padding: 16, gap: 14, paddingBottom: 28 },
  hero: { gap: 8, paddingHorizontal: 4, paddingTop: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerHairline: { width: 18, height: 2, borderRadius: 999, backgroundColor: theme.colors.accent },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.muted, textTransform: 'uppercase' },
  asunto: { fontSize: 22, fontWeight: '800', color: theme.colors.primary, lineHeight: 26, letterSpacing: -0.3 },
  desc: { fontSize: 13, color: theme.colors.textSoft, lineHeight: 19 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metaGrid: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  metaDot: { color: theme.colors.borderStrong, fontSize: 11 },
  metaSoft: { fontSize: 11, color: theme.colors.mutedSoft },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.primary, marginBottom: 10 },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dotCol: { alignItems: 'center', width: 12 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: theme.colors.accent, marginTop: 4 },
  line: { flex: 1, width: 1, backgroundColor: theme.colors.border, marginTop: 6, opacity: 0.8 },
  timelineBody: { flex: 1, gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border, borderStyle: 'dashed' },
  comment: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border, borderStyle: 'dashed' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  composer: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 10, ...theme.shadow.soft },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: theme.colors.text, minHeight: 44, textAlignVertical: 'top', backgroundColor: theme.colors.surfaceAlt },
  editInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt },
  solBox: { backgroundColor: theme.colors.surfaceAlt, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
  solLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.colors.primary },
  solText: { fontSize: 12, color: theme.colors.textSoft, lineHeight: 16 },
  hint: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  switchLabel: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  sendBtn: { backgroundColor: theme.colors.primary, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnGhost: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  btnGhostText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  btnDanger: { backgroundColor: theme.colors.danger },
  btnDangerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  retryBtn: { marginTop: 10, backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
