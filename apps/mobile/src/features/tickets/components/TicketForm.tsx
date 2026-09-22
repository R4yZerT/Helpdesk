// RF-06 — Formulario de creación de ticket (sub-componente de CreateTicketScreen)
import { StyleSheet } from 'react-native';
import { Text, TextInput, View } from 'react-native';
import { FilterDropdown, resolverMesaId, theme } from '@helpdesk/shared';
import type { CreateTicketInput, TicketCategoria, Mesa, TecnicoDeMesa, PrediccionCategoria } from '@helpdesk/shared';

type Props = {
  form: CreateTicketInput;
  errors: Partial<Record<keyof CreateTicketInput, string>>;
  touched: Record<string, boolean>;
  categorias: TicketCategoria[];
  mesas: Mesa[];
  tecnicosMesa: TecnicoDeMesa[];
  sugerencia: PrediccionCategoria | null;
  iaLoading: boolean;
  onChange: (f: CreateTicketInput) => void;
  onTouched: (t: Record<string, boolean>) => void;
  onSelectCategoria: (c: TicketCategoria) => void;
  onApplySugerencia: () => void;
};

export function TicketForm({ form, errors, touched, categorias, mesas, tecnicosMesa, sugerencia, iaLoading, onChange, onTouched, onSelectCategoria, onApplySugerencia }: Props) {
  const sugerenciaCat = sugerencia ? categorias.find(c => c.id === sugerencia.categoriaId) : null;
  const isSugerenciaAplicada = sugerencia ? form.categoriaId === sugerencia.categoriaId : false;
  const mesaOptions = mesas.map(m => ({ value: m.id, label: m.nombre }));
  const categoriaOptions = (form.mesaId ? categorias.filter(c => resolverMesaId(c.dominio, mesas) === form.mesaId).map(c => ({ value: c.id, label: `${c.subcategoria} · ${c.dominio}` })) : []);
  const tecnicoOptions = [{ value: '', label: 'Sin asignar (cola de mesa)' }, ...tecnicosMesa.map(t => ({ value: t.id, label: t.fullName }))];
  const iaFuente = sugerencia?.fuente === 'beto' ? 'modelo BETO' : 'reglas locales';

  return (
    <View style={s.wrapper}>
      <Text style={s.label}>Asunto *</Text>
      <TextInput
        value={form.asunto}
        onChangeText={(v) => onChange({ ...form, asunto: v })}
        onBlur={() => onTouched({ ...touched, asunto: true })}
        placeholder="Ej: No enciende el equipo del aula 301"
        placeholderTextColor={theme.colors.mutedSoft}
        style={s.input}
        maxLength={200}
      />
      <Text style={s.hint}>{form.asunto.length}/200</Text>
      {touched.asunto && errors.asunto ? <Text style={s.error}>{errors.asunto}</Text> : null}

      <Text style={s.label}>Descripción *</Text>
      <TextInput
        value={form.descripcion}
        onChangeText={(v) => onChange({ ...form, descripcion: v })}
        onBlur={() => onTouched({ ...touched, descripcion: true })}
        placeholder="Describe el problema con detalle (mín. 20 caracteres para activar la IA)"
        placeholderTextColor={theme.colors.mutedSoft}
        style={[s.input, s.textarea]}
        multiline numberOfLines={5} maxLength={5000}
      />
      <Text style={s.hint}>{form.descripcion.length}/5000 · {form.descripcion.trim().length < 20 ? `faltan ${20 - form.descripcion.trim().length} caracteres para IA` : 'listo para analizar'}</Text>
      {touched.descripcion && errors.descripcion ? <Text style={s.error}>{errors.descripcion}</Text> : null}

      {/* Bloque IA */}
      <View style={s.iaBlock}>
        {iaLoading ? (
          <View style={s.iaLoading}><Text style={s.iaLoadingText}>Analizando descripción…</Text></View>
        ) : sugerencia && sugerenciaCat ? (
          <View style={s.aiCard}>
            <View style={s.aiHead}>
              <Text style={s.aiTitle}>IA sugiere</Text>
              <Text style={s.aiPct}>{Math.round(sugerencia.confianza * 100)}%</Text>
              {isSugerenciaAplicada ? <Text style={s.aiApplied}>✓ Aplicada</Text> : null}
            </View>
            <Text style={s.aiText}>{sugerenciaCat.subcategoria} · {sugerenciaCat.dominio} · Prioridad {sugerencia.prioridad} · {iaFuente}</Text>
            {!isSugerenciaAplicada ? (
              <View style={s.aiRow}>
                <Text style={s.aiBtn} onPress={onApplySugerencia}>Aplicar sugerencia</Text>
                <Text style={s.aiHint}>o elige otra categoría abajo</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={s.iaIdle}><Text style={s.iaIdleText}>✦ Escribe al menos 20 caracteres para activar IA</Text></View>
        )}
      </View>

      <View style={s.dropdownRow}>
        <FilterDropdown<number>
          label="Dependencia *" value={form.mesaId ?? ''} options={mesaOptions} placeholder="Seleccionar dependencia"
          onSelect={(v) => {
            const id = v === '' ? null : Number(v);
            onChange({ ...form, mesaId: id, categoriaId: id ? form.categoriaId : 0, tecnicoAsignadoId: null });
            onTouched({ ...touched, mesaId: true });
          }}
        />
        <FilterDropdown<number>
          label="Categoría *" value={form.categoriaId || ''} options={categoriaOptions} placeholder={form.mesaId ? 'Seleccionar categoría' : 'Elige dependencia primero'}
          onSelect={(v) => {
            if (v === '') { onChange({ ...form, categoriaId: 0 }); return; }
            const cat = categorias.find(c => c.id === Number(v));
            if (cat) onSelectCategoria(cat);
            else onChange({ ...form, categoriaId: Number(v) });
            onTouched({ ...touched, categoriaId: true });
          }}
        />
      </View>
      <Text style={s.sectionHint}>La IA sugiere dependencia y categoría. Al cambiar categoría, prioridad y dependencia se recalculan.</Text>
      <FilterDropdown<string>
        label="Técnico (opcional)" value={form.tecnicoAsignadoId ?? ''} options={tecnicoOptions} placeholder={form.mesaId ? 'Seleccionar técnico' : 'Elige dependencia primero'}
        onSelect={(v) => onChange({ ...form, tecnicoAsignadoId: v === '' ? null : String(v) })}
      />
      <Text style={s.sectionHint}>Vacío = cola de la dependencia. La IA no sugiere técnico.</Text>
      {touched.categoriaId && errors.categoriaId ? <Text style={s.error}>{errors.categoriaId}</Text> : null}
      {touched.mesaId && errors.mesaId ? <Text style={s.error}>{errors.mesaId}</Text> : null}

      <View style={s.prioLockedRow}><Text style={s.sectionTitle}>Prioridad</Text><Text style={{ color: theme.colors.text }}>{form.prioridad}</Text></View>
      <View style={s.prioLockedBox}>
        <Text style={s.prioLockedText}>Asignada automáticamente por categoría</Text>
        <Text style={s.prioLockedSub}>No editable · {form.prioridad === 'critica' ? 'SLA 60 min' : form.prioridad === 'alta' ? 'SLA 4 h' : form.prioridad === 'media' ? 'SLA 24 h' : 'SLA 72 h'}</Text>
      </View>
      {touched.prioridad && errors.prioridad ? <Text style={s.error}>{errors.prioridad}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { gap: 12 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSoft, letterSpacing: 0.2 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, minHeight: 44 },
  textarea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 11 },
  hint: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'right', fontWeight: '600' },
  error: { fontSize: 11, color: theme.colors.danger, fontWeight: '600' },
  iaBlock: { minHeight: 44 },
  iaLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12 },
  iaLoadingText: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  iaIdle: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', borderRadius: 12, padding: 12 },
  iaIdleText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600', lineHeight: 16 },
  aiCard: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 12, padding: 12, gap: 6 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiTitle: { fontSize: 11, fontWeight: '800', color: theme.colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  aiPct: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  aiText: { fontSize: 12, color: theme.colors.textSoft, fontWeight: '600' },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  aiBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, color: '#fff', fontWeight: '800', fontSize: 11 },
  aiApplied: { fontSize: 11, color: theme.colors.success, fontWeight: '700' },
  aiHint: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  dropdownRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' as const },
  sectionHint: { fontSize: 11, color: theme.colors.muted, marginTop: -6 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.text },
  prioLockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prioLockedBox: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, gap: 2 },
  prioLockedText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSoft },
  prioLockedSub: { fontSize: 11, color: theme.colors.muted, lineHeight: 16 },
});