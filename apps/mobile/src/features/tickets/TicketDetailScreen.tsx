// RF-09/10/11/13/14/15 — Detalle Stitch: split 8+4, FSM naranja, SLA 35m, Timeline 5 nodos
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { addComentario, cancelTicket, fetchTecnicoNombres, getTicketDetail, reassignTicket, transitionTicket, updateTicket, validateComentario, validateUpdateTicket, ESTADOS, fetchMesas, fetchCategorias, nextEstadosParaRol, formatEstado, type TicketDetail, getSlaEstado, getSlaProgreso, formatSlaRestante, getSlaMinutosRestantes, getSlaVencimiento, slaEstadoLabel } from '@helpdesk/shared';
import { Card, theme, useFeedback } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { reportError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { TicketHeader } from './components/TicketHeader';
import { FsmActions } from './components/FsmActions';
import { TicketProgress } from './components/TicketProgress';
import { TicketTabs } from './components/TicketTabs';

type Props = {
  route: { params: { id: string } };
  navigation?: { goBack?: () => void; canGoBack?: () => boolean; navigate?: (name: string, params?: object) => void };
};

export function TicketDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const fb = useFeedback();
  const handleBack = () => {
    const nav = navigation as { canGoBack?: () => boolean; goBack?: () => void; navigate?: (name: string) => void } | undefined;
    if (nav?.canGoBack?.()) nav.goBack?.();
    else if (nav?.goBack) nav.goBack();
    else nav?.navigate?.('MisSolicitudes');
  };
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const { profile } = useAuth();
  const canComment = !!profile && ['usuario', 'tecnico', 'jefe'].includes(profile.rol);
  const canInternal = !!profile && ['tecnico', 'jefe', 'administrador'].includes(profile.rol);
  const isSolicitante = profile?.rol === 'usuario';
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
  const [mesas, setMesas] = useState<Record<number, string>>({});
  const [categorias, setCategorias] = useState<Record<number, string>>({});
  const [tecnicoNombres, setTecnicoNombres] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getTicketDetail(supabase, id);
      setDetail(d);
      try {
        const ms = await fetchMesas(supabase);
        const m = ms.find((x) => x.id === d.ticket.mesaId);
        if (m) setMesaNombre(m.nombre);
        setMesas(Object.fromEntries(ms.map((x) => [x.id, x.nombre])));
      } catch (e) { reportError(e, { flujo: 'detalle-mesas' }); }
      try {
        const cats = await fetchCategorias(supabase);
        setCategorias(Object.fromEntries(cats.map((c) => [c.id, `${c.dominio} · ${c.subcategoria}`])));
      } catch (e) { reportError(e, { flujo: 'detalle-categorias' }); }
      try {
        const ids = [d.ticket.tecnicoAsignadoId, d.ticket.usuarioId, ...d.estados.flatMap((e) => [e.tecnicoDe, e.tecnicoPara, e.usuarioId])].filter((x): x is string => !!x);
        if (ids.length > 0) {
          const map = await fetchTecnicoNombres(supabase, ids);
          if (Object.keys(map).length > 0) setTecnicoNombres(map);
        }
      } catch (e) { reportError(e, { flujo: 'detalle-tecnicos' }); }
    } catch (e) {
      reportError(e, { flujo: 'detalle-load' });
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
    fb.ask({
      title: 'Cancelar solicitud',
      message: '¿Seguro que quieres cerrar esta solicitud?',
      confirmText: 'Sí, cerrar',
      cancelText: 'No',
      onConfirm: async () => { try { await cancelTicket(supabase, id); await load(); } catch (e) { fb.show('Error', e instanceof Error ? e.message : String(e), 'error'); } },
    });
  };
  const onTransition = async (estado: string) => {
    const sol = isSolicitante ? (detail?.ticket.solucionAplicada ?? solucion) : solucion;
    if ((estado === 'solucionado' || estado === 'cerrado') && sol.trim().length < 5) {
      setTransError('Describe la solución aplicada (mín. 5 caracteres) — requerida para ' + formatEstado(estado as never));
      return;
    }
    setTransLoading(estado);
    setTransError(null);
    try {
      await transitionTicket(supabase, id, estado as any, { solucionAplicada: sol || undefined, onError: (e) => reportError(e, { flujo: 'transicion-comentario' }) });
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

  const { ticket } = detail;
  const nombreActor = (id?: string | null) => (id ? (tecnicoNombres[id] ?? 'Usuario') : null);
  const isOwner = profile?.id === ticket.usuarioId;
  const canEdit = isOwner && ticket.estado === 'abierto' && !ticket.tecnicoAsignadoId;
  const canCancel = canEdit;
  const isTecnicoLike = profile && ['tecnico','jefe','administrador'].includes(profile.rol);
  const isJefeAdmin = profile && ['jefe','administrador'].includes(profile.rol);
  const canReassign = !!isJefeAdmin || (!!isTecnicoLike && ticket.tecnicoAsignadoId === profile?.id);
  const nextEstados = nextEstadosParaRol(profile?.rol, ticket.estado as any, ESTADOS);
  const slaVence = (ticket as any).slaVenceEn ? new Date((ticket as any).slaVenceEn) : getSlaVencimiento(ticket.creadoEn, ticket.prioridad as any);
  const slaEstado = getSlaEstado({ creadoEn: ticket.creadoEn, prioridad: ticket.prioridad as any, estado: ticket.estado, venceEn: slaVence.toISOString(), fechaResolucion: ticket.fechaResolucion });
  const slaPct = Math.round(Math.min(100, getSlaProgreso(ticket.creadoEn, slaVence.toISOString())));
  const slaRest = formatSlaRestante(getSlaMinutosRestantes(slaVence));
  const slaFillColor = slaEstado === 'vencido' || slaEstado === 'vencido_tarde' ? theme.colors.danger : slaEstado === 'por_vencer' ? theme.colors.accent : slaEstado === 'cumplido' || slaEstado === 'vigente' ? theme.colors.success : theme.colors.muted;
  const slaBigLabel = ticket.estado === 'cerrado' || ticket.estado === 'solucionado' ? slaEstadoLabel(slaEstado) : slaRest;

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" style={{ backgroundColor: theme.colors.bg }}>
      <TicketHeader
        detail={detail}
        tecnicoNombres={tecnicoNombres}
        mesas={mesas}
        categorias={categorias}
        editing={editing}
        editAsunto={editAsunto}
        editDesc={editDesc}
        editSaving={editSaving}
        editError={editError}
        isWide={isWide}
        onBack={handleBack}
        onEdit={startEdit}
        onSaveEdit={onSaveEdit}
        onCancelEdit={() => setEditing(false)}
        onEditAsunto={setEditAsunto}
        onEditDesc={setEditDesc}
      />

      <View style={isWide ? { flexDirection: 'row', gap: 16, alignItems: 'flex-start' } : { gap: 12 }}>
        {/* Left column */}
        <View style={{ gap: 12, flex: isWide ? 8 : undefined }}>
          <Card style={{ gap: 12 }}>
            {/* Description / edit handled in TicketHeader */}
            {canEdit && !editing ? (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable onPress={startEdit} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}><Text style={{ color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 }}>Editar</Text></Pressable>
                <Pressable onPress={onCancelTicket} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: theme.colors.danger, borderWidth: 1, borderColor: '#FECACA' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Cancelar solicitud</Text></Pressable>
              </View>
            ) : null}
          </Card>
          <TicketTabs
            detail={detail}
            activeTab={activeTab}
            tecnicoNombres={tecnicoNombres}
            mesas={mesas}
            categorias={categorias}
            profileId={profile?.id}
            canComment={canComment}
            canInternal={canInternal}
            interno={interno}
            mensaje={mensaje}
            sending={sending}
            sendError={sendError}
            onTabChange={setActiveTab}
            onMensajeChange={setMensaje}
            onInternoChange={setInterno}
            onSend={onSend}
          />
        </View>

        {/* Right column */}
        <View style={{ gap: 12, flex: isWide ? 4 : undefined }}>
          <FsmActions
            detail={detail}
            tecnicoNombres={tecnicoNombres}
            profileRol={profile?.rol}
            canReassign={canReassign}
            showTrans={showTrans}
            showReassign={showReassign}
            solucion={solucion}
            reassignTecnico={reassignTecnico}
            reassignMesa={reassignMesa}
            transLoading={transLoading}
            transError={transError}
            reassignError={reassignError}
            isSolicitante={isSolicitante}
            nextEstados={nextEstados}
            onTransition={onTransition}
            onReassign={onReassign}
            onCancelTicket={onCancelTicket}
            onSetShowTrans={setShowTrans}
            onSetShowReassign={setShowReassign}
            onSolucion={setSolucion}
            onReassignTecnico={setReassignTecnico}
            onReassignMesa={setReassignMesa}
          />
          <TicketProgress
            detail={detail}
            tecnicoNombres={tecnicoNombres}
            slaEstado={slaEstado}
            slaPct={slaPct}
            slaRest={slaRest}
            slaBigLabel={slaBigLabel}
            slaFillColor={slaFillColor}
            slaVence={slaVence}
            isWide={isWide}
          />
        </View>
      </View>
      {fb.modal}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, backgroundColor: theme.colors.bg },
  loadingDot: { width: 36, height: 3, borderRadius: 999, backgroundColor: theme.colors.primary, opacity: 0.9 },
  muted: { color: theme.colors.muted, fontSize: 12, lineHeight: 16 },
  error: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
  retryBtn: { marginTop: 10, backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  container: { padding: 16, gap: 16, paddingBottom: 28 },
  header: { gap: 10, paddingHorizontal: 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: theme.colors.primary },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.muted, textTransform: 'uppercase' },
  backLink: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  slaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  slaBadgeText: { fontSize: 10, fontWeight: '800', color: '#991B1B', textTransform: 'uppercase', letterSpacing: 0.6 },
  asunto: { fontSize: 20, fontWeight: '800', color: theme.colors.text, lineHeight: 26, letterSpacing: -0.3 },
  desc: { fontSize: 13, color: theme.colors.textSoft, lineHeight: 19 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.text, marginBottom: 2 },
  composer: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 10 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: theme.colors.text, minHeight: 44, textAlignVertical: 'top', backgroundColor: theme.colors.surfaceAlt },
  editInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt },
  solBox: { backgroundColor: theme.colors.surfaceAlt, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
  solLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.colors.primary },
  solText: { fontSize: 12, color: theme.colors.textSoft, lineHeight: 16 },
  solTextMuted: { fontSize: 12, color: theme.colors.mutedSoft, lineHeight: 16, fontStyle: 'italic' },
  hint: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  switchLabel: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  sendBtn: { backgroundColor: theme.colors.primary, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnAccent: { backgroundColor: theme.colors.accent, borderWidth: 1, borderColor: '#FED7AA' },
  btnAccentText: { color: theme.colors.inkOnAccent, fontWeight: '800', fontSize: 12 },
  btnGhost: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  btnGhostText: { color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 },
  btnDanger: { backgroundColor: theme.colors.danger },
  btnDangerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
  adjThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: theme.colors.border },
  adjBadge: { width: 56, height: 56, borderRadius: 8, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  adjBadgeText: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
  adjName: { fontSize: 12, fontWeight: '700', color: theme.colors.text, flex: 1 },
  adjLink: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
});