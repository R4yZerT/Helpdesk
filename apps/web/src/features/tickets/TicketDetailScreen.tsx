// RF-09/15 — Detalle paralelo 3 queries + inline comentario (A+A: interno solo tecnico/jefe)
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { addComentario, getTicketDetail, validateComentario, type TicketDetail } from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Props = { route: { params: { id: string } } };

export function TicketDetailScreen({ route }: Props) {
  const { id } = route.params;
  const { profile } = useAuth();
  const canComment = !!profile && ['empleado', 'tecnico', 'jefe'].includes(profile.rol);
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
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>Cargando detalle…</Text></View>;
  }
  if (error) {
    return <View style={s.center}><Text style={s.error}>{error}</Text><Text style={s.muted} onPress={load}>Tocar para reintentar</Text></View>;
  }
  if (!detail) return <View style={s.center}><Text style={s.muted}>Sin datos</Text></View>;

  const { ticket, estados, comentarios } = detail;
  const charCount = mensaje.length;

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <Text style={s.numero}>Ticket #{ticket.numero} · {ticket.estado} · {ticket.prioridad}</Text>
        <Text style={s.asunto}>{ticket.asunto}</Text>
        <Text style={s.desc}>{ticket.descripcion}</Text>
        <Text style={s.meta}>Creado {new Date(ticket.creadoEn).toLocaleString('es-ES')} · Mesa {ticket.mesaId} · Cat {ticket.categoriaId}</Text>
        {ticket.tecnicoAsignadoId ? <Text style={s.meta}>Técnico: {ticket.tecnicoAsignadoId.slice(0, 8)}…</Text> : <Text style={s.muted}>Sin técnico asignado</Text>}
      </View>

      <Text style={s.section}>Historial ({estados.length})</Text>
      {estados.length === 0 ? <Text style={s.muted}>Sin cambios de estado aún</Text> : estados.map((e) => (
        <View key={e.id} style={s.row}>
          <Text style={s.rowTitle}>{e.tipoEvento === 'estado' ? `${e.estadoAnterior ?? '—'} → ${e.estadoNuevo ?? '—'}` : `Asignación ${e.tecnicoDe?.slice(0, 6) ?? '—'} → ${e.tecnicoPara?.slice(0, 6) ?? '—'}`}</Text>
          <Text style={s.muted}>{new Date(e.creadoEn).toLocaleString('es-ES')}</Text>
          {e.comentario ? <Text style={s.meta}>{e.comentario}</Text> : null}
        </View>
      ))}

      <Text style={s.section}>Comentarios ({comentarios.length})</Text>
      {comentarios.length === 0 ? <Text style={s.muted}>Sin comentarios</Text> : comentarios.map((c) => (
        <View key={c.id} style={s.row}>
          <View style={s.rowHeader}>
            <Text style={s.rowTitle}>{c.usuarioId.slice(0, 8)}…</Text>
            {c.interno ? <View style={s.internoBadge}><Text style={s.internoText}>interno</Text></View> : null}
          </View>
          <Text style={s.desc}>{c.comentario}</Text>
          <Text style={s.muted}>{new Date(c.creadoEn).toLocaleString('es-ES')}</Text>
        </View>
      ))}

      {/* RF-15 inline input — Usabilidad: sin modal, accesible, contador, guard interno */}
      <View style={s.composer} accessibilityRole="none" accessibilityLabel="Agregar comentario">
        <Text style={s.section}>Agregar avance</Text>
        {!canComment ? <Text style={s.muted}>No tienes permiso para comentar en este ticket</Text> : (
          <>
            <TextInput
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Escribe tu avance…"
              placeholderTextColor="#94a3b8"
              style={s.input}
              multiline
              numberOfLines={3}
              maxLength={2000}
              accessibilityLabel="Mensaje del comentario"
              editable={!sending}
            />
            <Text style={s.hint}>{charCount}/2000 {charCount > 2000 ? '— excede límite' : ''}</Text>
            {canInternal ? (
              <View style={s.switchRow}>
                <Text style={s.switchLabel}>Interno (solo equipo)</Text>
                <Switch value={interno} onValueChange={setInterno} disabled={sending} accessibilityLabel="Marcar como interno" />
              </View>
            ) : null}
            {sendError ? <Text style={s.error} accessibilityRole="alert">{sendError}</Text> : null}
            <Pressable
              onPress={onSend}
              disabled={sending || !mensaje.trim()}
              style={[s.sendBtn, (sending || !mensaje.trim()) && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Enviar comentario"
              accessibilityState={{ disabled: sending || !mensaje.trim() }}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.sendText}>Enviar</Text>}
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { color: theme.colors.muted, fontSize: 12 },
  error: { color: theme.colors.danger, fontSize: 12 },
  container: { padding: 16, gap: 12, backgroundColor: theme.colors.bg },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
  numero: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, textTransform: 'capitalize' },
  asunto: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  desc: { fontSize: 13, color: theme.colors.primary, lineHeight: 18 },
  meta: { fontSize: 11, color: theme.colors.muted },
  section: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, marginTop: 8 },
  row: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
  internoBadge: { backgroundColor: '#7c3aed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.radius.full },
  internoText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  composer: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 8, marginTop: 4 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.primary, minHeight: 72, textAlignVertical: 'top' },
  hint: { fontSize: 10, color: theme.colors.muted, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  sendBtn: { backgroundColor: theme.colors.primary, paddingVertical: 10, borderRadius: theme.radius.md, alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
