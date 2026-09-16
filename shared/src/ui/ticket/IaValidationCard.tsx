// Valida la clasificación IA sugerida al crear (RF IA validación).
// El técnico asignado confirma (sí) o reclasifica (no, obligatorio).
// Sin respuesta el registro queda pendiente y NO es apto para entrenamiento.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  confirmarClasificacion,
  corregirClasificacion,
  getIaFeedback,
  type TicketIaFeedback,
} from '../../ia-feedback.js';
import { theme } from '../theme.js';
import { FilterDropdown } from '../FilterDropdown.js';

type Props = {
  supabase: SupabaseClient;
  ticketId: string;
  ticketMesaId: number | null;
  ticketCategoriaId: number | null;
  validadorId: string | null;
  mesas: { id: number; nombre: string }[];
  categorias: { id: number; dominio: string; subcategoria: string }[];
  onValidated?: (fb: TicketIaFeedback) => void;
};

export function IaValidationCard({ supabase, ticketId, ticketMesaId, ticketCategoriaId, validadorId, mesas, categorias, onValidated }: Props) {
  const [fb, setFb] = useState<TicketIaFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modoCorregir, setModoCorregir] = useState(false);
  const [nuevaMesa, setNuevaMesa] = useState<number | ''>('');
  const [nuevaCategoria, setNuevaCategoria] = useState<number | ''>('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getIaFeedback(supabase, ticketId)
      .then((r) => { if (alive) setFb(r); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [supabase, ticketId]);

  if (loading) {
    return (
      <View style={s.box}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={s.muted}>Revisando clasificación IA…</Text>
      </View>
    );
  }
  // Sin fila (tickets legacy) o ya validada → no bloquear.
  if (!fb || fb.estado !== 'pendiente') return null;
  if (!validadorId) return null;

  const mesaSug = mesas.find((m) => m.id === fb.sugeridoMesaId)?.nombre ?? `#${fb.sugeridoMesaId ?? '—'}`;
  const catSug = categorias.find((c) => c.id === fb.sugeridoCategoriaId);
  const conf = fb.confianza != null ? `${Math.round(fb.confianza * 100)}%` : '—';

  const onSi = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await confirmarClasificacion(supabase, ticketId, validadorId);
      setFb(r);
      onValidated?.(r);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  };

  const onNoGuardar = async () => {
    if (nuevaMesa === '' || nuevaCategoria === '') {
      setError('Reclasifica: elige dependencia y categoría correctas (obligatorio)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await corregirClasificacion(supabase, ticketId, validadorId, { mesaId: Number(nuevaMesa), categoriaId: Number(nuevaCategoria) });
      setFb(r);
      onValidated?.(r);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  };

  const catOptions = (nuevaMesa === '' ? categorias : categorias.filter(() => true)).map((c) => ({ value: c.id, label: `${c.dominio} · ${c.subcategoria}` }));

  return (
    <View style={s.card} accessibilityRole="alert">
      <Text style={s.title}>✦ Valida la clasificación IA (obligatorio)</Text>
      <Text style={s.text}>
        Sugerido: {catSug ? `${catSug.dominio} · ${catSug.subcategoria}` : `Cat ${fb.sugeridoCategoriaId ?? '—'}`} · {mesaSug} · conf {conf} · fuente {fb.fuente}
      </Text>
      <Text style={s.textMuted}>Actual del ticket: mesa {ticketMesaId ?? '—'} · categoría {ticketCategoriaId ?? '—'}. ¿Está bien clasificado?</Text>
      {!modoCorregir ? (
        <View style={s.row}>
          <Pressable onPress={onSi} disabled={saving} style={[s.btn, s.btnYes]} accessibilityRole="button" accessibilityLabel="Sí, clasificación correcta">
            <Text style={s.btnYesText}>{saving ? 'Guardando…' : 'Sí, está bien'}</Text>
          </Pressable>
          <Pressable onPress={() => setModoCorregir(true)} disabled={saving} style={[s.btn, s.btnNo]} accessibilityRole="button" accessibilityLabel="No, reclasificar">
            <Text style={s.btnNoText}>No, reclasificar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.col}>
          <FilterDropdown<number>
            label="Dependencia correcta *"
            value={nuevaMesa}
            options={mesas.map((m) => ({ value: m.id, label: m.nombre }))}
            placeholder="Seleccionar dependencia"
            onSelect={(v) => setNuevaMesa(v === '' ? '' : Number(v))}
          />
          <FilterDropdown<number>
            label="Categoría correcta *"
            value={nuevaCategoria}
            options={catOptions}
            placeholder="Seleccionar categoría"
            onSelect={(v) => setNuevaCategoria(v === '' ? '' : Number(v))}
          />
          <View style={s.row}>
            <Pressable onPress={() => setModoCorregir(false)} disabled={saving} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostText}>Volver</Text>
            </Pressable>
            <Pressable onPress={onNoGuardar} disabled={saving} style={[s.btn, s.btnYes]}>
              <Text style={s.btnYesText}>{saving ? 'Guardando…' : 'Guardar corrección'}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  card: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12, gap: 8 },
  title: { fontSize: 12, fontWeight: '800', color: '#92400E' },
  text: { fontSize: 12, color: theme.colors.textSoft, fontWeight: '600' },
  textMuted: { fontSize: 11, color: theme.colors.muted },
  muted: { fontSize: 11, color: theme.colors.muted },
  row: { flexDirection: 'row', gap: 8 },
  col: { gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  btnYes: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  btnYesText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  btnNo: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  btnNoText: { color: theme.colors.textSoft, fontWeight: '800', fontSize: 12 },
  btnGhost: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  btnGhostText: { color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 },
  error: { fontSize: 11, color: theme.colors.danger, fontWeight: '700' },
});
