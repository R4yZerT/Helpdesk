// RF-06 — Panel de sugerencia IA (BETO / reglas) — sub-componente de CreateTicketScreen
import { Pressable, Text, View } from 'react-native';
import type { PrediccionCategoria, TicketCategoria } from '@helpdesk/shared';

type Props = {
  sugerencia: PrediccionCategoria | null;
  iaLoading: boolean;
  sugerenciaCat: TicketCategoria | undefined;
  isSugerenciaAplicada: boolean;
  iaFuente: string;
  onApply: () => void;
};

export function IaSugerenciaPanel({ sugerencia, iaLoading, sugerenciaCat, isSugerenciaAplicada, iaFuente, onApply }: Props) {
  if (iaLoading) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>Analizando descripción…</Text>
      </View>
    );
  }
  if (sugerencia && sugerenciaCat) {
    return (
      <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 12, padding: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#0A5CB8', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 }}>IA sugiere</Text>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#0A5CB8', backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>{Math.round(sugerencia.confianza * 100)}%</Text>
          {isSugerenciaAplicada ? <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700' }}>✓ Aplicada</Text> : null}
        </View>
        <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>{sugerenciaCat.subcategoria} · {sugerenciaCat.dominio} · Prioridad {sugerencia.prioridad}</Text>
        {!isSugerenciaAplicada ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Pressable onPress={onApply} style={{ backgroundColor: '#0A5CB8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>Aplicar sugerencia</Text>
            </Pressable>
            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>o elige otra categoría abajo</Text>
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 12, padding: 12 }}>
      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', lineHeight: 16 }}>✦ Escribe al menos 20 caracteres: la IA sugerirá dependencia y categoría (sin técnico).</Text>
    </View>
  );
}