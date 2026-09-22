// RF-08 — Tarjeta de ticket (reutilizable en MisSolicitudes / Bandeja)
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, TecnicoChip, theme } from '@helpdesk/shared';
import { getSlaEstado, getSlaVencimiento, getSlaMinutosRestantes, formatSlaRestante } from '@helpdesk/shared';
import type { Ticket } from '@helpdesk/shared';

type Props = {
  ticket: Ticket;
  mesaName: (id: number | null) => string;
  tecnicoNombres: Record<string, string>;
  onPress: () => void;
};

function prioridadTone(p: string) {
  if (p === 'critica') return 'accent' as const;
  if (p === 'alta') return 'danger' as const;
  if (p === 'media') return 'warning' as const;
  return 'success' as const;
}
function estadoTone(e: string) {
  if (e === 'abierto') return 'muted' as const;
  if (e === 'en_proceso') return 'info' as const;
  if (e === 'solucionado') return 'success' as const;
  if (e === 'cerrado') return 'ink' as const;
  if (e === 'devuelto') return 'danger' as const;
  if (e === 'programado') return 'warning' as const;
  return 'muted' as const;
}
function prettyEstado(e: string) { return e.replace('_', ' '); }

function slaBadge(ticket: Ticket) {
  if (ticket.estado === 'cerrado' || ticket.estado === 'solucionado') return null;
  const venceIso = (ticket as Ticket & { slaVenceEn?: string | null }).slaVenceEn ?? getSlaVencimiento(ticket.creadoEn, ticket.prioridad as any).toISOString();
  const estado = getSlaEstado({ creadoEn: ticket.creadoEn, prioridad: ticket.prioridad as any, estado: ticket.estado, venceEn: venceIso });
  const rest = getSlaMinutosRestantes(venceIso);
  if (estado === 'vencido') return <Badge label={`Vencido · ${formatSlaRestante(Math.floor(rest))}`} tone="danger" />;
  if (estado === 'por_vencer') return <Badge label={`Por vencer · ${formatSlaRestante(Math.floor(rest))}`} tone="warning" />;
  return null;
}

export function TicketRow({ ticket, mesaName, tecnicoNombres, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.96, transform: [{ scale: 0.992 }] }]} accessibilityRole="button" accessibilityLabel={`Ticket ${ticket.numero} ${ticket.asunto}`}>
      <Card style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.numero}>#{String(ticket.numero).padStart(4, '0')}</Text>
          <View style={s.badges}>
            <Badge label={ticket.prioridad} tone={prioridadTone(ticket.prioridad)} />
            <Badge label={prettyEstado(ticket.estado)} tone={estadoTone(ticket.estado)} />
            {slaBadge(ticket)}
          </View>
        </View>
        <Text style={s.asunto} numberOfLines={2}>{ticket.asunto}</Text>
        <Text style={s.desc} numberOfLines={2}>{ticket.descripcion}</Text>
        <View style={s.metaRow}>
          <Text style={s.meta}>{mesaName(ticket.mesaId)} · {new Date(ticket.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</Text>
          <TecnicoChip nombre={ticket.tecnicoAsignadoId ? (tecnicoNombres[ticket.tecnicoAsignadoId] ?? 'Técnico asignado') : null} />
        </View>
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  cardPress: { flex: 1 },
  card: { gap: 10, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numero: { fontSize: 12, fontWeight: '800', color: theme.colors.muted, letterSpacing: 0.6, fontFamily: theme.font.mono },
  badges: { flexDirection: 'row', gap: 6 },
  asunto: { fontSize: 14, fontWeight: '800', color: theme.colors.text, lineHeight: 19, letterSpacing: -0.2 },
  desc: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '600', letterSpacing: 0.3 },
});