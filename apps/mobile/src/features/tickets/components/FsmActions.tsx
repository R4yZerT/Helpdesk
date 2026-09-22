// RF-09 — Acciones FSM + reasignación — sub-componente de TicketDetailScreen
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { theme } from '@helpdesk/shared';
import type { TicketDetail } from '@helpdesk/shared';

type Props = {
  detail: TicketDetail;
  tecnicoNombres: Record<string, string>;
  profileRol: string | undefined;
  canReassign: boolean;
  showTrans: boolean;
  showReassign: boolean;
  solucion: string;
  reassignTecnico: string;
  reassignMesa: string;
  transLoading: string | null;
  transError: string | null;
  reassignError: string | null;
  isSolicitante: boolean;
  nextEstados: string[];
  onTransition: (e: string) => void;
  onReassign: () => void;
  onCancelTicket: () => void;
  onSetShowTrans: (v: boolean) => void;
  onSetShowReassign: (v: boolean) => void;
  onSolucion: (v: string) => void;
  onReassignTecnico: (v: string) => void;
  onReassignMesa: (v: string) => void;
};

export function FsmActions({ detail, tecnicoNombres, profileRol, canReassign, showTrans, showReassign, solucion, reassignTecnico, reassignMesa, transLoading, transError, reassignError, isSolicitante, nextEstados, onTransition, onReassign, onCancelTicket, onSetShowTrans, onSetShowReassign, onSolucion, onReassignTecnico, onReassignMesa }: Props) {
  const { ticket } = detail;
  const formatEstado = (e: string) => {
    const m: Record<string, string> = { abierto: 'Abierto', en_proceso: 'En proceso', solucionado: 'Solucionado', cerrado: 'Cerrado', devuelto: 'Devuelto' };
    return m[e] ?? e;
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.text, marginBottom: 2 }}>Acciones de Ciclo de Vida</Text>
      {isSolicitante ? (
        nextEstados.length > 0 ? (
          <View style={{ gap: 8 }}>
            {transError ? <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '600' }}>{transError}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {nextEstados.map((e) => (
                <Pressable key={e} onPress={() => onTransition(e)} disabled={!!transLoading} style={[{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, e === 'cerrado' && { backgroundColor: theme.colors.primary, borderColor: '#FED7AA' }]}>
                  {transLoading === e ? <ActivityIndicator size="small" color={e === 'cerrado' ? '#fff' : theme.colors.primary} /> : <Text style={e === 'cerrado' ? { color: '#fff', fontWeight: '700', fontSize: 12 } : { color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>{e === 'cerrado' ? 'Confirmar cierre' : 'Devolver al técnico'}</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ color: '#64748B', fontSize: 12 }}>{ticket.estado === 'solucionado' ? 'Cargando acciones…' : 'Sin acciones disponibles — el equipo técnico gestiona este ticket'}</Text>
        )
      ) : (
        <>
          <Pressable onPress={() => onSetShowTrans(!showTrans)} style={{ backgroundColor: theme.colors.accent, borderWidth: 1, borderColor: '#FED7AA', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' }}>
            <Text style={{ color: theme.colors.inkOnAccent, fontWeight: '800', fontSize: 12 }}>{showTrans ? 'Ocultar' : 'Solucionar Incidente'}</Text>
          </Pressable>
          {showTrans ? (
            <View style={{ gap: 8 }}>
              <TextInput value={solucion} onChangeText={onSolucion} placeholder="Describe la solución" style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt }} multiline maxLength={5000} />
              {transError ? <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '600' }}>{transError}</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {nextEstados.map((e) => (
                  <Pressable key={e} onPress={() => onTransition(e)} disabled={!!transLoading} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
                    <Text style={{ color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 }}>{formatEstado(e)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <View style={{ gap: 8, marginTop: 4 }}>
            <Pressable onPress={() => onSetShowTrans(true)} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}><Text style={{ color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 }}>Requerir Información</Text></Pressable>
            {canReassign ? (
              <Pressable onPress={() => onSetShowReassign(!showReassign)} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}><Text style={{ color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 }}>{showReassign ? 'Ocultar reasignar' : 'Reasignar Técnico'}</Text></Pressable>
            ) : null}
          </View>
          {showReassign ? (
            <View style={{ gap: 8 }}>
              <TextInput value={reassignTecnico} onChangeText={onReassignTecnico} placeholder="UUID técnico (o 'null')" style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt }} autoCapitalize="none" />
              <TextInput value={reassignMesa} onChangeText={onReassignMesa} placeholder="ID mesa (número)" style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt }} keyboardType="numeric" />
              {reassignError ? <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '600' }}>{reassignError}</Text> : null}
              <Pressable onPress={onReassign} disabled={!!transLoading} style={{ paddingVertical: 13, borderRadius: 12, backgroundColor: theme.colors.primary, borderWidth: 1, borderColor: '#FED7AA', alignItems: 'center', opacity: transLoading ? 0.6 : 1 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Confirmar reasignación</Text>
              </Pressable>
            </View>
          ) : null}
          {nextEstados.length === 0 && !canReassign && !showTrans ? <Text style={{ color: '#64748B', fontSize: 12 }}>Sin acciones disponibles</Text> : null}
        </>
      )}
    </View>
  );
}