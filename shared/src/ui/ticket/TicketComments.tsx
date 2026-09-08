// RF-15 — Componentes compartidos para comentarios (pulido y organización)
// Evita duplicación entre TicketDetailScreen y DetalleTecnicoScreen (web/mobile)
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Badge } from '../components.js';
import { theme } from '../theme.js';
import type { TicketComentario } from '../../tickets.js';

export function TicketCommentList({ comentarios }: { comentarios: TicketComentario[] }) {
  if (comentarios.length === 0) {
    return <Text style={s.muted}>Sin comentarios — inicia el hilo con tu avance.</Text>;
  }
  return (
    <View style={{ gap: 0 }}>
      {comentarios.map((c) => (
        <View key={c.id} style={[s.comment, c.interno && s.commentInternal]}>
          <View style={s.rowHeader}>
            <Text style={s.rowTitle}>{c.usuarioId.slice(0, 8)}…</Text>
            {c.interno ? <Badge label="interno · confidencial" tone="accent" /> : <Badge label="público" tone="muted" />}
            <Text style={s.mutedSmall}>{new Date(c.creadoEn).toLocaleDateString('es-ES')}</Text>
          </View>
          <Text style={s.desc}>{c.comentario}</Text>
        </View>
      ))}
    </View>
  );
}

type ComposerProps = {
  mensaje: string;
  onChange: (v: string) => void;
  interno: boolean;
  onInternoChange: (v: boolean) => void;
  canInternal: boolean;
  sending: boolean;
  error: string | null;
  onSend: () => void;
  canComment: boolean;
  label?: string;
};

export function TicketCommentComposer({
  mensaje,
  onChange,
  interno,
  onInternoChange,
  canInternal,
  sending,
  error,
  onSend,
  canComment,
  label = 'Agregar avance',
}: ComposerProps) {
  if (!canComment) return <Text style={s.muted}>No tienes permiso para comentar en este ticket</Text>;
  const charCount = mensaje.length;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.section}>{label}</Text>
      <TextInput
        value={mensaje}
        onChangeText={onChange}
        placeholder="Escribe tu avance"
        placeholderTextColor={theme.colors.mutedSoft}
        style={s.input}
        multiline
        numberOfLines={3}
        maxLength={2000}
        accessibilityLabel="Mensaje del comentario"
        editable={!sending}
      />
      <Text style={[s.hint, charCount > 1800 && { color: theme.colors.warning } as any]}>{charCount}/2000</Text>
      {canInternal ? (
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Interno — solo equipo</Text>
          <Switch value={interno} onValueChange={onInternoChange} disabled={sending} trackColor={{ true: theme.colors.accent }} thumbColor="#fff" accessibilityLabel="Marcar como interno" />
        </View>
      ) : null}
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.error} accessibilityRole="alert">
            {error}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onSend}
        disabled={sending || !mensaje.trim()}
        style={[s.sendBtn, (sending || !mensaje.trim()) && { opacity: 0.45 }]}
        accessibilityRole="button"
        accessibilityLabel="Enviar comentario"
        accessibilityState={{ disabled: sending || !mensaje.trim() }}
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.sendText}>Enviar avance</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  muted: { color: theme.colors.muted, fontSize: 12, lineHeight: 16 },
  mutedSmall: { color: theme.colors.mutedSoft, fontSize: 11 },
  desc: { fontSize: 13, color: theme.colors.textSoft, lineHeight: 19 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  comment: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border, borderStyle: 'dashed' },
  commentInternal: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, padding: 10, borderStyle: 'solid' },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.text, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    color: theme.colors.text,
    minHeight: 44,
    textAlignVertical: 'top',
    backgroundColor: theme.colors.surfaceAlt,
  },
  hint: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'right' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  switchLabel: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  errorBox: { backgroundColor: '#FDF1F0', borderWidth: 1, borderColor: '#F4C7C3', borderRadius: 12, padding: 10 },
  error: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
  sendBtn: { backgroundColor: theme.colors.primary, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
});
