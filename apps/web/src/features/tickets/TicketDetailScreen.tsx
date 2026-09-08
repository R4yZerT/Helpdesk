// RF-09/10/11/13/14/15 — Detalle Stitch: split 8+4, FSM naranja, SLA 35m, Timeline 5 nodos
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { addComentario, canTransition, cancelTicket, getTicketDetail, reassignTicket, transitionTicket, updateTicket, validateComentario, validateUpdateTicket, ESTADOS, fetchMesas, fetchCategorias, type TicketDetail } from '@helpdesk/shared';
import { Badge, Card, Divider, theme, FeedbackModal } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Props = { route: { params: { id: string } } };

const tonoEstado = (e: string) => {
  if (e === 'abierto') return 'muted' as const;
  if (e === 'en_proceso' || e === 'programado') return 'info' as const;
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

export function TicketDetailScreen({ route }: Props) {
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
  const [editing, setEditing] = useState(false);
  const [editAsunto, setEditAsunto] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
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
  const [mesaNombre, setMesaNombre] = useState<string>('');
  const [feedback, setFeedback] = useState<{ visible: boolean; variant: 'success' | 'error' | 'warning' | 'info' | 'confirm'; title: string; message?: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getTicketDetail(supabase, id);
      setDetail(d);
      // resolver mesa nombre
      try { const ms = await fetchMesas(supabase); const m = ms.find((x) => x.id === d.ticket.mesaId); if (m) setMesaNombre(m.nombre); } catch {}
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_adjuntos', filter: `ticket_id=eq.${id}` }, load)
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
      setFeedback({ visible: true, variant: 'success', title: 'Comentario enviado', message: 'Tu avance se publicó correctamente' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSendError(msg);
      setFeedback({ visible: true, variant: 'error', title: 'Error al comentar', message: msg });
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
      setFeedback({ visible: true, variant: 'success', title: 'Ticket actualizado', message: 'Los cambios se guardaron correctamente' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEditError(msg);
      setFeedback({ visible: true, variant: 'error', title: 'Error al guardar', message: msg });
    } finally { setEditSaving(false); }
  };
  const onCancelTicket = () => setConfirmCancel(true);
  const doCancelTicket = async () => {
    setCancelLoading(true);
    try {
      await cancelTicket(supabase, id);
      setConfirmCancel(false);
      await load();
      setFeedback({ visible: true, variant: 'success', title: 'Solicitud cancelada', message: 'El ticket fue cerrado correctamente' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFeedback({ visible: true, variant: 'error', title: 'Error al cancelar', message: msg });
    } finally { setCancelLoading(false); }
  };
  const onTransition = async (estado: string) => {
    setTransLoading(estado);
    setTransError(null);
    try {
      await transitionTicket(supabase, id, estado as any, { solucionAplicada: solucion || undefined });
      setShowTrans(false);
      setSolucion('');
      await load();
      setFeedback({ visible: true, variant: 'success', title: 'Estado actualizado', message: `Ticket pasó a ${estado}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTransError(msg);
      setFeedback({ visible: true, variant: 'error', title: 'Error al cambiar estado', message: msg });
    } finally { setTransLoading(null); }
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
      setFeedback({ visible: true, variant: 'success', title: 'Ticket reasignado', message: 'La reasignación se aplicó correctamente' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setReassignError(msg);
      setFeedback({ visible: true, variant: 'error', title: 'Error al reasignar', message: msg });
    } finally { setReassignLoading(false); }
  };

  if (loading && !detail) {
    return <View style={s.center}><View style={s.loadingDot} /><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando expediente…</Text></View>;
  }
  if (error) {
    return <View style={s.center}><Card><Text style={s.error}>{error}</Text><Pressable onPress={load} style={s.retryBtn}><Text style={s.retryText}>Reintentar</Text></Pressable></Card></View>;
  }
  if (!detail) return <View style={s.center}><Text style={s.muted}>Sin datos</Text></View>;

  const { ticket, estados, comentarios, adjuntos = [] } = detail;
  const onOpenAdjunto = async (a: { storagePath: string }) => {
    try {
      const { data } = await supabase.storage.from('ticket-adjuntos').createSignedUrl(a.storagePath, 60);
      const url = data?.signedUrl ?? supabase.storage.from('ticket-adjuntos').getPublicUrl(a.storagePath).data.publicUrl;
      if (url && typeof window !== 'undefined') window.open(url, '_blank');
    } catch {}
  };
  const isOwner = profile?.id === ticket.usuarioId;
  const canEdit = isOwner && ticket.estado === 'abierto' && !ticket.tecnicoAsignadoId;
  const canCancel = canEdit;
  const isTecnicoLike = profile && ['tecnico','jefe','administrador'].includes(profile.rol);
  const isJefeAdmin = profile && ['jefe','administrador'].includes(profile.rol);
  const canReassign = !!isJefeAdmin || (!!isTecnicoLike && ticket.tecnicoAsignadoId === profile?.id);
  const nextEstados = ESTADOS.filter((e) => canTransition(ticket.estado as any, e as any));
  const charCount = mensaje.length;
  const slaPct = 75; // demo Stitch 35 min restantes 75%

  const header = (
    <View style={s.header}>
      <View style={s.kickerRow}><Pressable><Text style={s.backLink}>← Volver a bandeja</Text></Pressable><View style={s.kickerDot} /><Text style={s.kicker}>Expediente · #{String(ticket.numero).padStart(4, '0')}</Text></View>
      <View style={s.pillsRow}>
        <View style={s.codePill}><Text style={s.codePillText}>#{String(ticket.numero).padStart(4, '0')}</Text></View>
        <Badge label={ticket.prioridad} tone={tonoPrioridad(ticket.prioridad)} />
        <Badge label={ticket.estado} tone={tonoEstado(ticket.estado)} />
        <View style={s.slaBadge}><View style={s.slaPulse} /><Text style={s.slaBadgeText}>SLA Activo</Text></View>
      </View>
      {editing ? (
        <View style={{ gap: 8 }}>
          <TextInput value={editAsunto} onChangeText={setEditAsunto} style={s.editInput} placeholder="Asunto (5-200)" maxLength={200} />
          <TextInput value={editDesc} onChangeText={setEditDesc} style={[s.editInput, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Descripción (10-5000)" multiline maxLength={5000} />
          {editError ? <Text style={s.error}>{editError}</Text> : null}
          <View style={s.actionRow}>
            <Pressable onPress={() => setEditing(false)} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable onPress={onSaveEdit} disabled={editSaving} style={[s.btn, s.btnPrimary, editSaving && { opacity: 0.6 }]}>{editSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Guardar</Text>}</Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={s.asunto}>{ticket.asunto}</Text>
          <Text style={s.meta}>{mesaNombre || `Mesa ${ticket.mesaId ?? '—'}`} · Cat {ticket.categoriaId} · Reportado {new Date(ticket.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
        </>
      )}
    </View>
  );

  const left = (
    <View style={{ gap: 12, flex: isWide ? 8 : undefined }}>
      <Card style={{ gap: 12 }}>
        <Text style={s.section}>Descripción</Text>
        {!editing ? <Text style={s.desc}>{ticket.descripcion}</Text> : null}
        {/* Terminal demo (Stitch) si descripción contiene código/bloque — placeholder */}
        <View style={s.terminal}><Text style={s.terminalText}>Ticket #{String(ticket.numero).padStart(4, '0')} · {ticket.estado} · Prioridad {ticket.prioridad}</Text></View>
        {ticket.solucionAplicada ? <View style={s.solBox}><Text style={s.solLabel}>Solución aplicada</Text><Text style={s.solText}>{ticket.solucionAplicada}</Text></View> : null}
        {canEdit && !editing ? (
          <View style={s.actionRow}>
            <Pressable onPress={startEdit} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>Editar</Text></Pressable>
            <Pressable onPress={onCancelTicket} style={[s.btn, s.btnDanger]}><Text style={s.btnDangerText}>Cancelar solicitud</Text></Pressable>
          </View>
        ) : null}
      </Card>

      {/* Tabs */}
      <Card style={{ gap: 0, padding: 0, overflow: 'hidden' } as any}>
        <View style={s.tabs}>
          {(['comentarios', 'historial', 'archivos'] as const).map((t) => (
            <Pressable key={t} onPress={() => setActiveTab(t)} style={[s.tab, activeTab === t && s.tabActive]}>
              <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t === 'comentarios' ? `Comentarios (${comentarios.length})` : t === 'historial' ? `Historial (${estados.length})` : `Archivos (${adjuntos.length})`}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ padding: 14, gap: 10 }}>
          {activeTab === 'comentarios' ? (
            comentarios.length === 0 ? <Text style={s.muted}>Sin comentarios — inicia el hilo con tu avance.</Text> : comentarios.map((c) => (
              <View key={c.id} style={[s.comment, c.interno && s.commentInternal]}>
                <View style={s.rowHeader}>
                  <Text style={s.rowTitle}>{c.usuarioId.slice(0, 8)}…</Text>
                  {c.interno ? <Badge label="interno · confidencial" tone="accent" /> : <Badge label="público" tone="muted" />}
                  <Text style={s.mutedSmall}>{new Date(c.creadoEn).toLocaleDateString('es-ES')}</Text>
                </View>
                <Text style={s.desc}>{c.comentario}</Text>
              </View>
            ))
          ) : activeTab === 'historial' ? (
            estados.length === 0 ? <Text style={s.muted}>Sin cambios de estado aún</Text> : estados.map((e) => (
              <View key={e.id} style={s.timelineRow}>
                <View style={s.dotCol}><View style={s.dot} /><View style={s.line} /></View>
                <View style={s.timelineBody}>
                  <Text style={s.rowTitle}>{e.tipoEvento === 'estado' ? `${e.estadoAnterior ?? '—'} → ${e.estadoNuevo ?? '—'}` : `Asignación ${e.tecnicoDe?.slice(0, 6) ?? '—'} → ${e.tecnicoPara?.slice(0, 6) ?? '—'}`}</Text>
                  <Text style={s.mutedSmall}>{new Date(e.creadoEn).toLocaleString('es-ES')}</Text>
                  {e.comentario ? <Text style={s.metaSmall}>{e.comentario}</Text> : null}
                </View>
              </View>
            ))
          ) : adjuntos.length === 0 ? (
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

      {/* Composer */}
      <View style={s.composer} accessibilityRole="none" accessibilityLabel="Agregar comentario">
        <Text style={s.section}>Agregar avance</Text>
        {!canComment ? <Text style={s.muted}>No tienes permiso para comentar en este ticket</Text> : (
          <>
            <TextInput
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Escribe tu avance"
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
    </View>
  );

  const right = (
    <View style={{ gap: 12, flex: isWide ? 4 : undefined }}>
      <Card style={{ gap: 10 }}>
        <Text style={s.section}>Acciones de Ciclo de Vida</Text>
        <Pressable onPress={() => setShowTrans((v) => !v)} style={[s.btn, s.btnAccent]}><Text style={s.btnAccentText}>{showTrans ? 'Ocultar' : 'Solucionar Incidente'}</Text></Pressable>
        {showTrans && nextEstados.length > 0 ? (
          <View style={{ gap: 8 }}>
            <TextInput value={solucion} onChangeText={setSolucion} placeholder="Describe la solución" style={s.input} multiline maxLength={5000} />
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
        <View style={s.ghostStack}>
          <Pressable onPress={() => setFeedback({ visible: true, variant: 'info', title: 'Próximamente', message: 'Escalado N3 estará disponible pronto' })} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>Escalar a Infra N3</Text></Pressable>
          <Pressable onPress={() => setShowTrans(true)} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>Requerir Información</Text></Pressable>
          {(canReassign) ? <Pressable onPress={() => setShowReassign((v) => !v)} style={[s.btn, s.btnGhost]}><Text style={s.btnGhostText}>{showReassign ? 'Ocultar reasignar' : 'Reasignar Técnico'}</Text></Pressable> : null}
        </View>
        {showReassign ? (
          <View style={{ gap: 8 }}>
            <TextInput value={reassignTecnico} onChangeText={setReassignTecnico} placeholder="UUID técnico (o 'null')" style={s.input} autoCapitalize="none" />
            <TextInput value={reassignMesa} onChangeText={setReassignMesa} placeholder="ID mesa (número)" style={s.input} keyboardType="numeric" />
            {reassignError ? <Text style={s.error}>{reassignError}</Text> : null}
            <Pressable onPress={onReassign} disabled={reassignLoading} style={[s.btn, s.btnPrimary, reassignLoading && { opacity: 0.6 }]}>{reassignLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Confirmar reasignación</Text>}</Pressable>
          </View>
        ) : null}
        {nextEstados.length === 0 && !canReassign && !showTrans ? <Text style={s.mutedSmall}>Sin acciones disponibles</Text> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={s.section}>Progreso del Ticket</Text>
        <View style={s.progressWrap}>
          {[
            { label: 'Ticket Creado', done: true, time: new Date(ticket.creadoEn).toLocaleString('es-ES') },
            { label: 'Asignado', done: !!ticket.tecnicoAsignadoId },
            { label: 'En Diagnóstico', done: ticket.estado === 'en_proceso', pulse: ticket.estado === 'en_proceso' },
            { label: 'Solución Propuesta', done: ticket.estado === 'solucionado' },
            { label: 'Cierre CSAT', done: ticket.estado === 'cerrado' },
          ].map((n, i) => (
            <View key={n.label} style={s.progressRow}>
              <View style={s.progressDotCol}><View style={[s.progressDot, n.done ? s.progressDotDone : s.progressDotTodo, n.pulse && s.progressDotPulse]} /><View style={s.progressLine} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.progressLabel, !n.done && { color: theme.colors.mutedSoft }]}>{n.label}</Text>
                {n.done ? <Text style={s.mutedSmall}>{n.time ?? ''}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: 8 }}>
        <Text style={s.section}>Control Compromiso SLA</Text>
        <Text style={s.slaBig}>{ticket.estado === 'cerrado' || ticket.estado === 'solucionado' ? 'Cumplido' : '35 min restantes'}</Text>
        <View style={s.slaBar}><View style={[s.slaFill, { width: `${slaPct}%`, backgroundColor: ticket.estado === 'solucionado' || ticket.estado === 'cerrado' ? theme.colors.success : theme.colors.danger }]} /></View>
        <View style={s.slaAlert}><Text style={s.slaAlertText}>{ticket.estado === 'cerrado' ? 'Cerrado dentro de compromiso' : ticket.prioridad === 'critica' ? 'Crítico <60 min · Riesgo alto' : 'Vigilar si no avanza en 2 h'}</Text></View>
        <View style={s.attrGrid}>
          <Text style={s.attrLabel}>Prioridad</Text><Text style={s.attrValue}>{ticket.prioridad}</Text>
          <Text style={s.attrLabel}>Estado</Text><Text style={s.attrValue}>{ticket.estado}</Text>
          <Text style={s.attrLabel}>Dependencia</Text><Text style={s.attrValue}>{mesaNombre || ticket.mesaId}</Text>
        </View>
      </Card>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" style={{ backgroundColor: theme.colors.bg }}>
      {header}
      <View style={[isWide ? { flexDirection: 'row', gap: 16, alignItems: 'flex-start' } : { gap: 12 }]}>
        {left}
        {right}
      </View>
      {feedback ? <FeedbackModal visible={feedback.visible} variant={feedback.variant as never} title={feedback.title} message={feedback.message} onClose={() => setFeedback(null)} onConfirm={() => setFeedback(null)} /> : null}
      <FeedbackModal visible={confirmCancel} variant="confirm" title="Cancelar solicitud" message="¿Seguro que quieres cerrar esta solicitud? Esta acción no se puede deshacer." confirmText="Sí, cerrar" cancelText="No" loading={cancelLoading} onConfirm={doCancelTicket} onClose={() => setConfirmCancel(false)} onCancel={() => setConfirmCancel(false)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: theme.colors.bg },
  loadingDot: { width: 36, height: 3, borderRadius: 999, backgroundColor: theme.colors.primary, opacity: 0.9 },
  muted: { color: theme.colors.muted, fontSize: 12, lineHeight: 16 },
  mutedSmall: { color: theme.colors.mutedSoft, fontSize: 11 },
  metaSmall: { fontSize: 11, color: theme.colors.textSoft, marginTop: 4 },
  error: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
  errorBox: { backgroundColor: '#FDF1F0', borderWidth: 1, borderColor: '#F4C7C3', borderRadius: 12, padding: 10 },
  container: { padding: 16, gap: 16, paddingBottom: 28 },
  header: { gap: 10, paddingHorizontal: 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: theme.colors.primary },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.muted, textTransform: 'uppercase' },
  backLink: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  codePill: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  codePillText: { fontSize: 11, fontWeight: '800', color: theme.colors.text, fontFamily: theme.font.mono },
  slaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  slaBadgeText: { fontSize: 10, fontWeight: '800', color: '#991B1B', textTransform: 'uppercase', letterSpacing: 0.6 },
  slaPulse: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.danger },
  asunto: { fontSize: 20, fontWeight: '800', color: theme.colors.text, lineHeight: 26, letterSpacing: -0.3 },
  meta: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  desc: { fontSize: 13, color: theme.colors.textSoft, lineHeight: 19 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metaGrid: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaDot: { color: theme.colors.borderStrong, fontSize: 11 },
  metaSoft: { fontSize: 11, color: theme.colors.mutedSoft },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.text, marginBottom: 2 },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dotCol: { alignItems: 'center', width: 12 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: theme.colors.primary, marginTop: 4 },
  line: { flex: 1, width: 1, backgroundColor: theme.colors.border, marginTop: 6, opacity: 0.8 },
  timelineBody: { flex: 1, gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  comment: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border, borderStyle: 'dashed' },
  commentInternal: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, padding: 10, borderStyle: 'solid' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  composer: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 10, ...theme.shadow.soft },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: theme.colors.text, minHeight: 44, textAlignVertical: 'top', backgroundColor: theme.colors.surfaceAlt },
  editInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt },
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
  btnAccent: { backgroundColor: theme.colors.accent, borderWidth: 1, borderColor: '#FED7AA' },
  btnAccentText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  btnGhost: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  btnGhostText: { color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 },
  btnDanger: { backgroundColor: theme.colors.danger },
  btnDangerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  retryBtn: { marginTop: 10, backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },
  tabTextActive: { color: theme.colors.primary },
  terminal: { backgroundColor: theme.colors.text, borderRadius: 10, padding: 12 },
  terminalText: { color: '#A7F3D0', fontSize: 11, fontFamily: theme.font.mono, fontWeight: '600' },
  ghostStack: { gap: 8, marginTop: 4 },
  progressWrap: { gap: 2, position: 'relative', paddingLeft: 6 },
  progressRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  progressDotCol: { alignItems: 'center', width: 12 },
  progressDot: { width: 10, height: 10, borderRadius: 999, borderWidth: 2, marginTop: 2 },
  progressDotDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  progressDotTodo: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
  progressDotPulse: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  progressLine: { flex: 1, width: 1, backgroundColor: theme.colors.border, marginTop: 4, opacity: 0.6 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  emptyFiles: { alignItems: 'center', padding: 12 },
  slaBig: { fontSize: 18, fontWeight: '800', color: theme.colors.danger, letterSpacing: -0.3 },
  slaBar: { height: 8, borderRadius: 999, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  slaFill: { height: '100%', borderRadius: 999 },
  slaAlert: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 8 },
  slaAlertText: { fontSize: 11, color: '#7F1D1D', fontWeight: '600', textAlign: 'center' },
  attrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8 },
  attrLabel: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, width: 90 },
  attrValue: { fontSize: 11, color: theme.colors.textSoft, fontWeight: '600', flex: 1 },
  adjRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 8 },
  adjThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: theme.colors.border } as any,
  adjName: { fontSize: 12, fontWeight: '700', color: theme.colors.text, flex: 1 },
  adjLink: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
});
