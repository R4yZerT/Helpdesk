// RF-09 — Header + edición inline de ticket — sub-componente de TicketDetailScreen
import { Pressable, Text, TextInput, View } from 'react-native';
import { Badge, theme } from '@helpdesk/shared';
import type { TicketDetail } from '@helpdesk/shared';

type Props = {
  detail: TicketDetail;
  tecnicoNombres: Record<string, string>;
  mesas: Record<number, string>;
  categorias: Record<number, string>;
  editing: boolean;
  editAsunto: string;
  editDesc: string;
  editSaving: boolean;
  editError: string | null;
  isWide: boolean;
  onBack: () => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditAsunto: (v: string) => void;
  onEditDesc: (v: string) => void;
};

export function TicketHeader({ detail, tecnicoNombres, mesas, categorias, editing, editAsunto, editDesc, editSaving, editError, isWide, onBack, onEdit, onSaveEdit, onCancelEdit, onEditAsunto, onEditDesc }: Props) {
  const { ticket, estados, comentarios, adjuntos = [] } = detail;
  const tonoEstado = (e: string) => { if (e === 'abierto') return 'muted' as const; if (e === 'en_proceso') return 'info' as const; if (e === 'solucionado') return 'success' as const; if (e === 'cerrado') return 'ink' as const; if (e === 'devuelto') return 'danger' as const; return 'muted' as const; };
  const tonoPrioridad = (p: string) => { if (p === 'critica') return 'accent' as const; if (p === 'alta') return 'danger' as const; if (p === 'media') return 'warning' as const; return 'muted' as const; };
  const nombreActor = (id?: string | null) => (id ? (tecnicoNombres[id] ?? 'Usuario') : null);
  const evAsignacion = estados.find((e) => e.tipoEvento === 'asignacion' && e.tecnicoPara != null);
  const tiempoAsignacion = evAsignacion?.creadoEn ? `${new Date(evAsignacion.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${nombreActor(evAsignacion.usuarioId) ? ` · por ${nombreActor(evAsignacion.usuarioId)}` : ''}` : undefined;
  const mesaNombre = ticket.mesaId ? (mesas[ticket.mesaId] ?? `Mesa ${ticket.mesaId}`) : '—';

  const header = (
    <View style={{ gap: 10, paddingHorizontal: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Volver a bandeja" hitSlop={8}><Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>← Volver a bandeja</Text></Pressable>
        <View style={{ width: 4, height: 4, borderRadius: 999, backgroundColor: theme.colors.primary }} />
        <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.muted, textTransform: 'uppercase' }}>Expediente · #{String(ticket.numero).padStart(4, '0')}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Badge label={ticket.prioridad} tone={tonoPrioridad(ticket.prioridad)} />
        <Badge label={ticket.estado} tone={tonoEstado(ticket.estado)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
          <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.danger }} />
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#991B1B', textTransform: 'uppercase', letterSpacing: 0.6 }}>SLA Activo</Text>
        </View>
      </View>
      {editing ? (
        <View style={{ gap: 8 }}>
          <TextInput value={editAsunto} onChangeText={onEditAsunto} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt }} placeholder="Asunto (5-200)" maxLength={200} />
          <TextInput value={editDesc} onChangeText={onEditDesc} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, minHeight: 80, textAlignVertical: 'top' }} placeholder="Descripción (10-5000)" multiline maxLength={5000} />
          {editError ? <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '600' }}>{editError}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={onCancelEdit} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}><Text style={{ color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 }}>Cancelar</Text></Pressable>
            <Pressable onPress={onSaveEdit} disabled={editSaving} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: theme.colors.primary, borderWidth: 1, borderColor: '#FED7AA', opacity: editSaving ? 0.6 : 1 }}>{editSaving ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Guardando…</Text> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Guardar</Text>}</Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, lineHeight: 26, letterSpacing: -0.3 }}>{ticket.asunto}</Text>
          <Text style={{ fontSize: 11, color: theme.colors.muted, fontWeight: '600' }}>{mesaNombre} · Cat {ticket.categoriaId} · Reportado {new Date(ticket.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
          {tiempoAsignacion ? <Text style={{ fontSize: 11, color: '#64748B' }}>Asignado {tiempoAsignacion}</Text> : null}
        </>
      )}
    </View>
  );

  return <View style={{ gap: 10, paddingHorizontal: 2 }}>{header}</View>;
}