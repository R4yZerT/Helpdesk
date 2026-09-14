// Admin — Afinidades de técnico por categoría (peso 1-3)
// Alimenta la sugerencia de auto-asignación (carga + afinidad). RLS: escritura admin.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  theme, type AdminUser, type TecnicoAfinidad, type TicketCategoria,
  fetchCategorias, listAfinidadesPorTecnico, setAfinidad, removeAfinidad,
  FilterDropdown, FeedbackModal,
} from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e ?? 'Error desconocido');
}

const PESOS = [
  { value: 1, label: '1 · baja' },
  { value: 2, label: '2 · media' },
  { value: 3, label: '3 · alta' },
];

export function TecnicoAfinidadesModal({ tecnico, onClose }: {
  tecnico: AdminUser | null;
  onClose: () => void;
}) {
  const [categorias, setCategorias] = useState<TicketCategoria[]>([]);
  const [afinidades, setAfinidades] = useState<TecnicoAfinidad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState<number | ''>('');
  const [nuevoPeso, setNuevoPeso] = useState(2);
  const [feedback, setFeedback] = useState<{ title: string; message?: string } | null>(null);

  const load = useCallback(async () => {
    if (!tecnico) return;
    setLoading(true);
    setError(null);
    try {
      const [cats, afs] = await Promise.all([
        fetchCategorias(supabase),
        listAfinidadesPorTecnico(supabase, tecnico.id),
      ]);
      setCategorias(cats);
      setAfinidades(afs);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [tecnico]);

  useEffect(() => { load(); }, [load]);

  const nombreCategoria = (id: number) => {
    const c = categorias.find((x) => x.id === id);
    return c ? `${c.subcategoria} · ${c.dominio}` : `Categoría #${id}`;
  };

  const onAdd = async () => {
    if (!tecnico || nuevaCategoria === '') return;
    setSaving(true);
    try {
      const a = await setAfinidad(supabase, tecnico.id, Number(nuevaCategoria), nuevoPeso);
      setAfinidades((prev) => {
        const next = prev.filter((x) => x.categoriaId !== a.categoriaId);
        return [...next, a].sort((x, y) => x.categoriaId - y.categoriaId);
      });
      setNuevaCategoria('');
      setFeedback({ title: 'Afinidad guardada', message: `${nombreCategoria(a.categoriaId)} · peso ${a.peso}` });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (a: TecnicoAfinidad) => {
    if (!tecnico) return;
    setSaving(true);
    try {
      await removeAfinidad(supabase, tecnico.id, a.categoriaId);
      setAfinidades((prev) => prev.filter((x) => x.categoriaId !== a.categoriaId));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const opcionesCategoria = categorias
    .filter((c) => !afinidades.some((a) => a.categoriaId === c.id))
    .map((c) => ({ value: c.id, label: `${c.subcategoria} · ${c.dominio}` }));

  return (
    <Modal visible={!!tecnico} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>Afinidades · {tecnico?.fullName}</Text>
          <Text style={s.hint}>Peso 1-3 por categoría: la auto-asignación prioriza técnicos afines con menor carga.</Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <>
              <Text style={s.section}>Definidas ({afinidades.length})</Text>
              {afinidades.length === 0 ? <Text style={s.muted}>Sin afinidades — el técnico solo compite por carga.</Text> : (
                <FlatList
                  data={afinidades}
                  keyExtractor={(a) => String(a.categoriaId)}
                  style={s.list}
                  renderItem={({ item }) => (
                    <View style={s.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{nombreCategoria(item.categoriaId)}</Text>
                        <Text style={s.rowSub}>peso {item.peso}</Text>
                      </View>
                      <Pressable onPress={() => onRemove(item)} disabled={saving} style={s.btnGhost}>
                        <Text style={s.btnGhostText}>Quitar</Text>
                      </Pressable>
                    </View>
                  )}
                />
              )}
              <Text style={s.section}>Añadir / actualizar</Text>
              {opcionesCategoria.length === 0 ? (
                <Text style={s.muted}>Todas las categorías ya tienen afinidad.</Text>
              ) : (
                <View style={s.addRow}>
                  <View style={{ flex: 2 }}>
                    <FilterDropdown<number>
                      label="Categoría"
                      value={nuevaCategoria}
                      onSelect={(v) => setNuevaCategoria(v === '' ? '' : Number(v))}
                      options={[{ value: '' as unknown as number, label: 'Seleccionar…' }, ...opcionesCategoria]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FilterDropdown<number>
                      label="Peso"
                      value={nuevoPeso}
                      onSelect={(v) => setNuevoPeso(Number(v))}
                      options={PESOS}
                    />
                  </View>
                  <Pressable onPress={onAdd} disabled={saving || nuevaCategoria === ''} style={[s.btnPrimary, (nuevaCategoria === '' || saving) && { opacity: 0.5 }]}>
                    <Text style={s.btnPrimaryText}>Añadir</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
          <Pressable onPress={onClose} style={[s.btnGhost, { marginTop: 12, alignSelf: 'stretch', alignItems: 'center' }]}>
            <Text style={s.btnGhostText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
      {feedback ? (
        <FeedbackModal visible variant="success" title={feedback.title} message={feedback.message} onClose={() => setFeedback(null)} onConfirm={() => setFeedback(null)} />
      ) : null}
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  card: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '88%', gap: 8 },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  hint: { fontSize: 11, color: theme.colors.muted },
  section: { fontSize: 12, fontWeight: '800', color: theme.colors.primary, marginTop: 8, textTransform: 'uppercase' },
  muted: { fontSize: 12, color: theme.colors.muted },
  error: { fontSize: 12, color: theme.colors.danger, fontWeight: '600' },
  list: { maxHeight: 200 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  rowSub: { fontSize: 11, color: theme.colors.muted },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  btnPrimary: { backgroundColor: theme.colors.primary, paddingHorizontal: 12, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  btnGhost: { borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  btnGhostText: { fontWeight: '800', fontSize: 12, color: theme.colors.text },
});
