// RF-09/15 — Detalle paralelo 3 queries + inline comentario (A+A: interno solo tecnico/jefe)
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { addComentario, getTicketDetail, validateComentario, type TicketDetail } from '@helpdesk/shared';
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

  if (loading && !detail) {
    return <View style={s.center}><View style={s.loadingDot} /><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando expediente…</Text></View>;
  }
  if (error) {
    return <View style={s.center}><Card><Text style={s.error}>{error}</Text><Pressable onPress={load} style={s.retryBtn}><Text style={s.retryText}>Reintentar</Text></Pressable></Card></View>;
  }
  if (!detail) return <View style={s.center}><Text style={s.muted}>Sin datos</Text></View>;

  const { ticket, estados, comentarios } = detail;
  const charCount = mensaje.length;

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" style={{ backgroundColor: theme.colors.bg }}>
      {/* Hero expediente */}
      <View style={s.hero}>
        <View style={s.kickerRow}><View style={s.kickerHairline} /><Text style={s.kicker}>Expediente  ·  #{String(ticket.numero).padStart(4, '0')}</Text></View>
        <Text style={s.asunto}>{ticket.asunto}</Text>
        <Text style={s.desc}>{ticket.descripcion}</Text>
        <View style={s.badges}><Badge label={ticket.estado} tone={tonoEstado(ticket.estado)} /><Badge label={ticket.prioridad} tone={tonoPrioridad(ticket.prioridad)} /></View>
        <Divider />
        <View style={s.metaGrid}>
          <Text style={s.meta}>Creado {new Date(ticket.creadoEn).toLocaleString('es-ES')}</Text>
          <Text style={s.metaDot}>·</Text>
          <Text style={s.meta}>Mesa {ticket.mesaId ?? '—'}  ·  Cat {ticket.categoriaId}</Text>
        </View>
        {ticket.tecnicoAsignadoId ? <Text style={s.metaSoft}>Técnico {ticket.tecnicoAsignadoId.slice(0, 8)}…</Text> : <Text style={s.metaSoft}>Sin técnico asignado</Text>}
      </View>

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
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: theme.colors.text, minHeight: 84, textAlignVertical: 'top', backgroundColor: theme.colors.surfaceAlt },
  hint: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  switchLabel: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  sendBtn: { backgroundColor: theme.colors.primary, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
  retryBtn: { marginTop: 10, backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
