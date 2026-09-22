// RF-09 — Progreso + SLA — sub-componente de TicketDetailScreen
import { Text, View } from 'react-native';
import { theme, getSlaMinutosRestantes, type TicketDetail } from '@helpdesk/shared';

function slaEstadoLabelLocal(e: string): string {
  const m: Record<string, string> = { vigente: 'Dentro de compromiso', 'por_vencer': 'Por vencer', vencido: 'Fuera de compromiso', cumplido: 'Cerrado dentro de compromiso ✓', vencido_tarde: 'Cerrado fuera de compromiso' };
  return m[e] ?? e;
}

type Props = {
  detail: TicketDetail;
  tecnicoNombres: Record<string, string>;
  slaEstado: string;
  slaPct: number;
  slaRest: string;
  slaBigLabel: string;
  slaFillColor: string;
  slaVence: Date;
  isWide: boolean;
};

export function TicketProgress({ detail, tecnicoNombres, slaEstado, slaPct, slaRest, slaBigLabel, slaFillColor, slaVence, isWide }: Props) {
  const { ticket, estados } = detail;
  const nombreActor = (id?: string | null) => (id ? (tecnicoNombres[id] ?? 'Usuario') : null);
  const evAsignacion = estados.find((e) => e.tipoEvento === 'asignacion' && e.tecnicoPara != null);
  const evDiagnostico = estados.find((e) => e.tipoEvento === 'estado' && e.estadoNuevo === 'en_proceso');
  const evSolucion = estados.find((e) => e.tipoEvento === 'estado' && e.estadoNuevo === 'solucionado');
  const evCierre = estados.find((e) => e.tipoEvento === 'estado' && e.estadoNuevo === 'cerrado');
  const conActor = (iso: string | null | undefined, actorId?: string | null) => iso ? `${new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${actorId && nombreActor(actorId) ? ` · por ${nombreActor(actorId)}` : ''}` : undefined;
  const tiempoAsignacion = conActor(evAsignacion?.creadoEn, evAsignacion?.usuarioId);
  const tiempoDiagnostico = conActor(evDiagnostico?.creadoEn, evDiagnostico?.usuarioId);
  const tiempoSolucion = conActor(ticket.fechaResolucion ?? evSolucion?.creadoEn, evSolucion?.usuarioId);
  const tiempoCierre = conActor(evCierre?.creadoEn, evCierre?.usuarioId);

  const progressSteps = [
    { label: 'Ticket Creado', done: true, time: new Date(ticket.creadoEn).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
    { label: ticket.tecnicoAsignadoId ? `Asignado — ${tecnicoNombres[ticket.tecnicoAsignadoId] ?? 'Técnico asignado'}` : 'Asignado', done: !!ticket.tecnicoAsignadoId || !!evAsignacion, time: tiempoAsignacion },
    { label: 'En Diagnóstico', done: !!evDiagnostico || ['en_proceso', 'solucionado', 'cerrado'].includes(ticket.estado), pulse: ticket.estado === 'en_proceso', time: tiempoDiagnostico },
    { label: 'Solución Propuesta', done: !!evSolucion || !!ticket.fechaResolucion || ['solucionado', 'cerrado'].includes(ticket.estado), time: tiempoSolucion },
    { label: 'Cierre CSAT', done: ticket.estado === 'cerrado', time: tiempoCierre },
  ];

  const slaEstadoColor = slaEstado === 'vencido' || slaEstado === 'vencido_tarde' ? theme.colors.danger : slaEstado === 'por_vencer' ? theme.colors.accent : slaEstado === 'cumplido' || slaEstado === 'vigente' ? theme.colors.success : theme.colors.muted;
  const alertStyle = slaEstado === 'vencido' ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' } : slaEstado === 'por_vencer' ? { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' } : slaEstado === 'vigente' || slaEstado === 'cumplido' ? { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' } : {};

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.text }}>Progreso del Ticket</Text>
      <View style={{ gap: 2, paddingLeft: 6 }}>
        {progressSteps.map((n) => (
          <View key={n.label} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
            <View style={{ alignItems: 'center', width: 12 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, borderWidth: 2, borderColor: n.done ? theme.colors.success : theme.colors.borderStrong, backgroundColor: n.done ? theme.colors.success : theme.colors.surface }} />
              <View style={{ flex: 1, width: 1, backgroundColor: theme.colors.border, marginTop: 4, opacity: 0.6 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text, opacity: n.done ? 1 : 0.6 }}>{n.label}</Text>
              {n.done ? <Text style={{ fontSize: 11, color: '#64748B' }}>{n.time ?? ''}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 8, marginTop: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.text }}>Control Compromiso SLA</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: slaEstadoColor, letterSpacing: -0.3 }}>{slaBigLabel}</Text>
        <Text style={{ fontSize: 11, color: '#64748B' }}>Vence {slaVence.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {slaEstadoLabelLocal(slaEstado)} · {slaPct}%</Text>
        <View style={{ height: 8, borderRadius: 999, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: 999, backgroundColor: slaFillColor, width: `${slaPct}%` }} />
        </View>
        <View style={{ backgroundColor: alertStyle.backgroundColor ?? '#F8FAFC', borderWidth: 1, borderColor: alertStyle.borderColor ?? theme.colors.border, borderRadius: 10, padding: 8 }}>
          <Text style={{ fontSize: 11, color: '#7F1D1D', fontWeight: '600', textAlign: 'center' }}>
            {slaEstado === 'vencido' ? 'Fuera de compromiso — requiere acción inmediata' : slaEstado === 'por_vencer' ? `Por vencer — quedan ~${getSlaMinutosRestantes(slaVence)} min` : slaEstado === 'cumplido' ? 'Cerrado dentro de compromiso ✓' : slaEstado === 'vencido_tarde' ? 'Cerrado fuera de compromiso' : 'Dentro de compromiso'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8 }}>
          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, width: 90 }}>Vence</Text>
          <Text style={{ fontSize: 11, color: theme.colors.textSoft, fontWeight: '600', flex: 1 }}>{slaVence.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, width: 90 }}>Técnico</Text>
          <Text style={{ fontSize: 11, color: theme.colors.textSoft, fontWeight: '600', flex: 1 }}>{ticket.tecnicoAsignadoId ? (tecnicoNombres[ticket.tecnicoAsignadoId] ?? 'Técnico asignado') : 'Sin asignar'}</Text>
        </View>
      </View>
    </View>
  );
}