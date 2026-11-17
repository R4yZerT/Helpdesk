// Valida la clasificación IA sugerida al crear (RF IA validación).
// El técnico asignado confirma (sí) o reclasifica (no, obligatorio).
// Sin respuesta el registro queda pendiente y NO es apto para entrenamiento.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  ticketTecnicoAsignadoId: string | null;
  validadorId: string | null;
  mesas: { id: number; nombre: string }[];
  categorias: { id: number; dominio: string; subcategoria: string }[];
  onValidated?: (fb: TicketIaFeedback) => void;
};

// Fuentes reales de una sugerencia; 'desconocida' = fila creada sin sugerencia.
const FUENTE_LABEL: Record<string, string> = {
  beto: 'BETO',
  reglas: 'reglas locales',
};

export function IaValidationCard({ supabase, ticketId, ticketMesaId, ticketCategoriaId, ticketTecnicoAsignadoId, validadorId, mesas, categorias, onValidated }: Props) {
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

  if (loading) return null;
  // Sin fila (tickets legacy) o ya validada → no bloquear.
  if (!fb || fb.estado !== 'pendiente') return null;
  // Solo valida el técnico al que se asignó automáticamente este ticket.
  if (!validadorId || validadorId !== ticketTecnicoAsignadoId) return null;
  // No presentar como IA una clasificación manual o de origen desconocido.
  if (!(fb.fuente in FUENTE_LABEL)) return null;
  // El trigger crea una fila vacía por ticket: sin sugerencia no hay nada que validar.
  const haySugerencia = fb.sugeridoCategoriaId != null && fb.sugeridoMesaId != null;
  if (!haySugerencia) return null;

  const mesaSug = mesas.find((m) => m.id === fb.sugeridoMesaId)?.nombre ?? 'No disponible';
  const catSug = categorias.find((c) => c.id === fb.sugeridoCategoriaId);
  const catSugLabel = catSug ? `${catSug.dominio} · ${catSug.subcategoria}` : 'No disponible';
  const conf = fb.confianza != null ? `${Math.round(fb.confianza * 100)}%` : null;
  const fuente = FUENTE_LABEL[fb.fuente] ?? null;
  const mesaActual = mesas.find((m) => m.id === ticketMesaId)?.nombre ?? 'No disponible';
  const catActual = categorias.find((c) => c.id === ticketCategoriaId);
  const catActualLabel = catActual ? `${catActual.dominio} · ${catActual.subcategoria}` : 'No disponible';

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

  const catOptions = categorias.map((c) => ({ value: c.id, label: `${c.dominio} · ${c.subcategoria}` }));

  return (
    <View style={s.card}>
      <View style={s.heading}>
        <Text style={s.title}>Validar clasificación sugerida</Text>
        <Text style={s.intro}>Como técnico asignado, confirma si la clasificación coincide con el problema reportado.</Text>
      </View>
      <View style={s.compare}>
        <View style={s.compareItem}>
          <Text style={s.label}>Sugerencia de IA</Text>
          <Text style={s.value}>{catSugLabel}</Text>
          <Text style={s.detail}>Dependencia: {mesaSug}</Text>
          {conf || fuente ? (
            <Text style={s.detail}>
              {[fuente ? `Fuente: ${fuente}` : null, conf ? `Confianza: ${conf}` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <View style={s.compareItem}>
          <Text style={s.label}>Clasificación actual</Text>
          <Text style={s.value}>{catActualLabel}</Text>
          <Text style={s.detail}>Dependencia: {mesaActual}</Text>
        </View>
      </View>
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
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 4, borderLeftColor: theme.colors.primary, borderRadius: 12, padding: 14, gap: 12, ...theme.shadow.soft },
  heading: { gap: 4 },
  title: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  intro: { fontSize: 12, lineHeight: 17, color: theme.colors.textSoft },
  compare: { gap: 8 },
  compareItem: { backgroundColor: theme.colors.surfaceAlt, borderRadius: 10, padding: 10, gap: 3 },
  label: { fontSize: 10, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  detail: { fontSize: 11, color: theme.colors.textSoft },
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
