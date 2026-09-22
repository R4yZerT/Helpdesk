// RF-09 — Tabs + archivos + composer — sub-componente de TicketDetailScreen
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { TicketCommentList, TicketCommentComposer, TicketHistoryList, theme } from '@helpdesk/shared';
import type { TicketDetail } from '@helpdesk/shared';

type Props = {
  detail: TicketDetail;
  activeTab: 'comentarios' | 'historial' | 'archivos';
  tecnicoNombres: Record<string, string>;
  mesas: Record<number, string>;
  categorias: Record<number, string>;
  profileId: string | undefined;
  canComment: boolean;
  canInternal: boolean;
  interno: boolean;
  mensaje: string;
  sending: boolean;
  sendError: string | null;
  onTabChange: (t: 'comentarios' | 'historial' | 'archivos') => void;
  onMensajeChange: (v: string) => void;
  onInternoChange: (v: boolean) => void;
  onSend: () => void;
};

function etiquetaAdjunto(mime?: string | null) {
  const m = String(mime ?? '');
  if (m === 'application/pdf') return 'PDF';
  if (m.includes('word')) return 'DOC';
  if (m.includes('sheet') || m.includes('excel')) return 'XLS';
  if (m === 'text/plain') return 'TXT';
  return 'FILE';
}

export function TicketTabs({ detail, activeTab, tecnicoNombres, mesas, categorias, profileId, canComment, canInternal, interno, mensaje, sending, sendError, onTabChange, onMensajeChange, onInternoChange, onSend }: Props) {
  const { ticket, estados, comentarios, adjuntos = [] } = detail;

  return (
    <View style={styles.tabsWrap}>
      <View style={styles.tabRow}>
        {(['comentarios', 'historial', 'archivos'] as const).map((t) => (
          <Pressable key={t} onPress={() => onTabChange(t)} style={[styles.tab, activeTab === t && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t === 'comentarios' ? `Comentarios (${comentarios.length})` : t === 'historial' ? `Historial (${estados.length + 1})` : `Archivos (${adjuntos.length})`}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        {activeTab === 'comentarios' ? <TicketCommentList comentarios={comentarios} /> : activeTab === 'historial' ? (
          <TicketHistoryList creadoEn={ticket.creadoEn} creadorId={ticket.usuarioId} estados={estados} nombres={{ usuarios: tecnicoNombres, mesas, categorias }} currentUserId={profileId} />
        ) : adjuntos.length === 0 ? (
          <View style={styles.emptyFiles}><Text style={{ color: '#64748B', fontSize: 12 }}>Sin archivos adjuntos.</Text></View>
        ) : (
          <View style={{ gap: 8 }}>
            {adjuntos.map((a) => (
              <Pressable key={a.id} onPress={async () => { try { const { data } = await supabase.storage.from('ticket-adjuntos').createSignedUrl(a.storagePath, 60); const url = data?.signedUrl ?? supabase.storage.from('ticket-adjuntos').getPublicUrl(a.storagePath).data.publicUrl; if (url) await Linking.openURL(url); } catch (e) { console.warn('[TicketTabs] open adjunto', e); } }} style={styles.adjRow}>
                {String(a.mime ?? '').startsWith('image/') ? (
                  <Image source={{ uri: supabase.storage.from('ticket-adjuntos').getPublicUrl(a.storagePath).data.publicUrl }} style={styles.adjThumb} />
                ) : (
                  <View style={styles.adjBadge}><Text style={styles.adjBadgeText}>{etiquetaAdjunto(a.mime)}</Text></View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.adjName}>{a.nombre}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{(a.size / 1024).toFixed(0)} KB · {a.mime}</Text>
                </View>
                <Text style={styles.adjLink}>{a.mime === 'application/pdf' ? 'Ver PDF' : 'Ver'}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.composer}>
        <TicketCommentComposer mensaje={mensaje} onChange={onMensajeChange} interno={interno} onInternoChange={onInternoChange} canInternal={canInternal} sending={sending} error={sendError} onSend={onSend} canComment={canComment} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsWrap: { gap: 12 },
  tabRow: { flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: theme.colors.primary },
  emptyFiles: { alignItems: 'center', padding: 12 },
  adjRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 8 },
  adjThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: theme.colors.border },
  adjBadge: { width: 56, height: 56, borderRadius: 8, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  adjBadgeText: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
  adjName: { fontSize: 12, fontWeight: '700', color: theme.colors.text, flex: 1 },
  adjLink: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
  composer: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 10 },
});