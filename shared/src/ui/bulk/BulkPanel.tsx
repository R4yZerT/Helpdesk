// H10 — Panel de acciones en lote (cerrar / cambiar mesa / prioridad).
// RN puro: sirve en web y mobile. La pantalla dueña maneja selección y ejecución.
import * as React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme.js';
import { PRIORIDADES, type BulkResultado, type PrioridadTicket } from '../../index.js';

export type BulkAccion = 'cerrar' | 'mesa' | 'prioridad';

type Props = {
  seleccionados: number;
  acciones: BulkAccion[];
  mesas: { id: number; nombre: string }[];
  ejecutando: boolean;
  resultado: BulkResultado | null;
  onLimpiar: () => void;
  onEjecutar: (accion: BulkAccion, args: { solucion?: string; mesaId?: number; prioridad?: PrioridadTicket }) => void;
  onCerrarResultado: () => void;
};

const TITULOS: Record<BulkAccion, string> = { cerrar: 'Cerrar en lote', mesa: 'Cambiar mesa en lote', prioridad: 'Cambiar prioridad en lote' };

export function BulkPanel({ seleccionados, acciones, mesas, ejecutando, resultado, onLimpiar, onEjecutar, onCerrarResultado }: Props) {
  const [accion, setAccion] = React.useState<BulkAccion | null>(null);
  const [solucion, setSolucion] = React.useState('');
  const [mesaId, setMesaId] = React.useState<number | null>(null);
  const [prioridad, setPrioridad] = React.useState<PrioridadTicket | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (seleccionados === 0 && !resultado) return null;

  const confirmar = () => {
    setError(null);
    if (!accion) return;
    if (accion === 'cerrar' && solucion.trim().length < 5) { setError('Solución mínimo 5 caracteres'); return; }
    if (accion === 'mesa' && mesaId == null) { setError('Elige la mesa destino'); return; }
    if (accion === 'prioridad' && !prioridad) { setError('Elige la prioridad'); return; }
    onEjecutar(accion, { solucion: solucion.trim() || undefined, mesaId: mesaId ?? undefined, prioridad: prioridad ?? undefined });
    setAccion(null);
  };

  return (
    <View style={s.bar}>
      {resultado ? (
        <View style={s.result} accessibilityLabel="Resultado del lote">
          <Text style={s.resultTitle}>Lote completado: {resultado.ok} ok, {resultado.fallos} fallos</Text>
          {resultado.items.filter((i) => !i.ok).slice(0, 3).map((i) => (
            <Text key={i.id} style={s.resultErr}>{i.id.slice(0, 8)}…: {i.error}</Text>
          ))}
          <Pressable onPress={onCerrarResultado} style={s.btnGhost} accessibilityRole="button" accessibilityLabel="Cerrar resultado">
            <Text style={s.btnGhostText}>Cerrar resultado</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.row}>
          <Text style={s.count} accessibilityLabel="Tickets seleccionados">{seleccionados} seleccionados</Text>
          {acciones.includes('cerrar') ? (
            <Pressable onPress={() => setAccion('cerrar')} style={s.btn} accessibilityRole="button" accessibilityLabel="Cerrar en lote">
              <Text style={s.btnText}>Cerrar</Text>
            </Pressable>
          ) : null}
          {acciones.includes('mesa') ? (
            <Pressable onPress={() => setAccion('mesa')} style={s.btn} accessibilityRole="button" accessibilityLabel="Cambiar mesa en lote">
              <Text style={s.btnText}>Mesa</Text>
            </Pressable>
          ) : null}
          {acciones.includes('prioridad') ? (
            <Pressable onPress={() => setAccion('prioridad')} style={s.btn} accessibilityRole="button" accessibilityLabel="Cambiar prioridad en lote">
              <Text style={s.btnText}>Prioridad</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onLimpiar} style={s.btnGhost} accessibilityRole="button" accessibilityLabel="Limpiar selección">
            <Text style={s.btnGhostText}>Limpiar</Text>
          </Pressable>
        </View>
      )}
      <Modal visible={accion !== null} transparent animationType="fade" onRequestClose={() => setAccion(null)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{accion ? TITULOS[accion] : ''} ({seleccionados})</Text>
            {accion === 'cerrar' ? (
              <TextInput value={solucion} onChangeText={setSolucion} placeholder="Solución aplicada al lote (mín. 5 caracteres)" multiline style={s.input} accessibilityLabel="Solución del lote" />
            ) : null}
            {accion === 'mesa' ? (
              <View style={s.chips}>
                {mesas.map((m) => (
                  <Pressable key={m.id} onPress={() => setMesaId(m.id)} style={[s.chip, mesaId === m.id && s.chipActive]} accessibilityRole="button" accessibilityLabel={`Mesa destino ${m.nombre}`}>
                    <Text style={[s.chipText, mesaId === m.id && s.chipTextActive]}>{m.nombre}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {accion === 'prioridad' ? (
              <View style={s.chips}>
                {PRIORIDADES.map((p) => (
                  <Pressable key={p} onPress={() => setPrioridad(p)} style={[s.chip, prioridad === p && s.chipActive]} accessibilityRole="button" accessibilityLabel={`Prioridad ${p}`}>
                    <Text style={[s.chipText, prioridad === p && s.chipTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={s.row}>
              <Pressable onPress={() => setAccion(null)} style={s.btnGhost} accessibilityRole="button" accessibilityLabel="Cancelar lote">
                <Text style={s.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirmar} disabled={ejecutando} style={[s.btnPrimary, ejecutando && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Confirmar lote">
                <Text style={s.btnPrimaryText}>{ejecutando ? 'Aplicando…' : 'Confirmar lote'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: 12, fontWeight: '800', color: theme.colors.text, marginRight: 'auto' },
  btn: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  btnGhost: { paddingHorizontal: 12, paddingVertical: 9 },
  btnGhostText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  btnPrimary: { backgroundColor: theme.colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  result: { gap: 4 },
  resultTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  resultErr: { fontSize: 11, color: theme.colors.danger },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 18, gap: 10, width: '100%', maxWidth: 440 },
  modalTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: theme.colors.text, minHeight: 70 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
  chipTextActive: { color: '#fff' },
  error: { fontSize: 12, color: theme.colors.danger, fontWeight: '700' },
});
