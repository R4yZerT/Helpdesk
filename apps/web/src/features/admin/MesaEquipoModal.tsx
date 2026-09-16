// Técnicos asignados por dependencia (web)
// Modal reutilizable: lista técnicos de la mesa, asigna/libera. Paridad con mobile.
// RLS: mesa:write (solo administrador).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  theme, type Mesa, type TecnicoDeMesa,
  listTecnicosPorMesa, asignarTecnicoAMesa, listUsers, FeedbackModal,
} from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? 'Error desconocido');
}

export function MesaEquipoModal({ mesa, onClose }: {
  mesa: Mesa | null;
  mesas: Mesa[];
  onClose: () => void;
}) {
  const [tecnicos, setTecnicos] = useState<TecnicoDeMesa[]>([]);
  const [candidatos, setCandidatos] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message?: string } | null>(null);

  const load = useCallback(async () => {
    if (!mesa) return;
    setLoading(true);
    setError(null);
    try {
      const t = await listTecnicosPorMesa(supabase, mesa.id);
      setTecnicos(t);
      // Candidatos a asignar: técnicos activos de cualquier mesa (o sin mesa)
      const res = await listUsers(supabase, { rol: 'tecnico', activo: true, page: 1, pageSize: 100 });
      setCandidatos(res.data.map((u) => ({
        value: u.id,
        label: `${u.fullName}${u.mesaNombre ? ` · ${u.mesaNombre}` : ' · sin mesa'}`,
      })));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [mesa]);

  useEffect(() => { load(); }, [load]);

  const onAsignar = async (tecnicoId: string) => {
    if (!mesa) return;
    setSaving(true);
    try {
      await asignarTecnicoAMesa(supabase, tecnicoId, mesa.id);
      setFeedback({ title: 'Técnico asignado', message: `Asignado a ${mesa.nombre}` });
      load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const onLiberar = async (t: TecnicoDeMesa) => {
    setSaving(true);
    try {
      await asignarTecnicoAMesa(supabase, t.id, null);
      setTecnicos((prev) => prev.filter((x) => x.id !== t.id));
      setFeedback({ title: 'Técnico liberado', message: `${t.fullName} quedó sin mesa asignada` });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const disponibles = candidatos.filter((c) => !tecnicos.some((t) => t.id === c.value)).slice(0, 8);

  return (
    <Modal visible={!!mesa} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>Equipo · {mesa?.nombre}</Text>
          <Text style={s.hint}>Técnicos asignados a esta dependencia.</Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <>
              <Text style={s.section}>Técnicos asignados ({tecnicos.length})</Text>
              {tecnicos.length === 0 ? <Text style={s.muted}>Sin técnicos asignados.</Text> : (
                <FlatList
                  data={tecnicos}
                  keyExtractor={(t) => t.id}
                  style={s.list}
                  renderItem={({ item }) => (
                    <View style={s.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{item.fullName}</Text>
                        <Text style={s.rowSub} numberOfLines={1}>{item.email || '—'}{item.activo ? '' : ' · inactivo'}</Text>
                      </View>
                      <Pressable onPress={() => onLiberar(item)} disabled={saving} style={s.btnGhost} accessibilityRole="button">
                        <Text style={s.btnGhostText}>Liberar</Text>
                      </Pressable>
                    </View>
                  )}
                />
              )}
              <Text style={s.section}>Asignar técnico</Text>
              {disponibles.length === 0 ? <Text style={s.muted}>No hay técnicos activos disponibles.</Text> : (
                <FlatList
                  data={disponibles}
                  keyExtractor={(c) => c.value}
                  style={s.list}
                  renderItem={({ item }) => (
                    <View style={s.row}>
                      <Text style={[s.rowName, { flex: 1 }]} numberOfLines={1}>{item.label}</Text>
                      <Pressable onPress={() => onAsignar(item.value)} disabled={saving} style={s.btnPrimary} accessibilityRole="button">
                        <Text style={s.btnPrimaryText}>Asignar</Text>
                      </Pressable>
                    </View>
                  )}
                />
              )}
            </>
          )}
          <View style={s.actions}>
            <Pressable onPress={onClose} style={s.btnGhost} accessibilityRole="button"><Text style={s.btnGhostText}>Cerrar</Text></Pressable>
          </View>
        </View>
      </View>
      {feedback ? (
        <FeedbackModal visible variant="success" title={feedback.title} message={feedback.message} onClose={() => setFeedback(null)} onConfirm={() => setFeedback(null)} />
      ) : null}
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 560, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, gap: 8, borderWidth: 1, borderColor: theme.colors.border },
  title: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  hint: { fontSize: 11, color: theme.colors.muted },
  section: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, marginTop: 8, textTransform: 'uppercase' },
  muted: { fontSize: 12, color: theme.colors.muted },
  error: { fontSize: 12, color: theme.colors.danger, fontWeight: '600' },
  list: { maxHeight: 200 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  rowSub: { fontSize: 11, color: theme.colors.muted },
  btnPrimary: { backgroundColor: theme.colors.primary, paddingHorizontal: 12, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  btnGhost: { borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt, flex: 1 },
  btnGhostText: { fontWeight: '800', fontSize: 12, color: theme.colors.text },
  actions: { flexDirection: 'row', marginTop: 8 },
});
