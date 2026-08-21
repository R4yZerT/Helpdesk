// RF-06 — Crear solicitud de mesa de ayuda
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  PRIORIDADES,
  createTicket,
  fetchCategorias,
  fetchMesas,
  validateCreateTicket,
  type CreateTicketInput,
  type Mesa,
  type TicketCategoria,
} from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

export function CreateTicketScreen({ navigation }: { navigation?: { goBack: () => void; navigate: (s: string) => void } }) {
  const [categorias, setCategorias] = useState<TicketCategoria[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CreateTicketInput>({
    categoriaId: 0,
    asunto: '',
    descripcion: '',
    prioridad: 'media',
    mesaId: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateTicketInput, string>>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoadingCats(true);
    try {
      const [cats, ms] = await Promise.all([fetchCategorias(supabase), fetchMesas(supabase)]);
      setCategorias(cats);
      setMesas(ms);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCats(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async () => {
    const errs = validateCreateTicket(form);
    setErrors(errs);
    setTouched({ categoriaId: true, asunto: true, descripcion: true, prioridad: true, mesaId: true });
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    try {
      const res = await createTicket(supabase, form);
      // RF-02 modal de confirmación
      Alert.alert('Solicitud creada', `Ticket #${res.numero} creado correctamente`, [
        {
          text: 'OK',
          onPress: () => {
            setForm({ categoriaId: 0, asunto: '', descripcion: '', prioridad: 'media', mesaId: null });
            setErrors({});
            setTouched({});
            navigation?.goBack?.();
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Error al crear', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCats) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.muted}>Cargando catálogos…</Text>
      </View>
    );
  }

  // Agrupar categorías por dominio
  const byDominio = categorias.reduce<Record<string, TicketCategoria[]>>((acc, c) => {
    (acc[c.dominio] ??= []).push(c);
    return acc;
  }, {});

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Crear solicitud</Text>
      <Text style={s.subtitle}>RF-06 · categoría, asunto, descripción, prioridad y dependencia</Text>

      {/* Categoría */}
      <Text style={s.label}>Categoría *</Text>
      {Object.entries(byDominio).map(([dominio, cats]) => (
        <View key={dominio} style={s.group}>
          <Text style={s.groupTitle}>{dominio}</Text>
          <View style={s.chips}>
            {cats.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setForm((f) => ({ ...f, categoriaId: c.id }))}
                style={[s.chip, form.categoriaId === c.id && s.chipActive]}
              >
                <Text style={[s.chipText, form.categoriaId === c.id && s.chipTextActive]}>{c.subcategoria}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {touched.categoriaId && errors.categoriaId ? <Text style={s.error}>{errors.categoriaId}</Text> : null}

      {/* Dependencia / Mesa */}
      <Text style={s.label}>Dependencia (mesa) *</Text>
      <View style={s.chips}>
        {mesas.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setForm((f) => ({ ...f, mesaId: m.id }))}
            style={[s.chip, form.mesaId === m.id && s.chipActive]}
          >
            <Text style={[s.chipText, form.mesaId === m.id && s.chipTextActive]}>{m.nombre}</Text>
          </Pressable>
        ))}
      </View>
      {touched.mesaId && errors.mesaId ? <Text style={s.error}>{errors.mesaId}</Text> : null}

      {/* Prioridad */}
      <Text style={s.label}>Prioridad *</Text>
      <View style={s.chips}>
        {PRIORIDADES.map((p) => (
          <Pressable
            key={p}
            onPress={() => setForm((f) => ({ ...f, prioridad: p }))}
            style={[s.chip, form.prioridad === p && s.chipActive]}
          >
            <Text style={[s.chipText, form.prioridad === p && s.chipTextActive]}>{p}</Text>
          </Pressable>
        ))}
      </View>
      {touched.prioridad && errors.prioridad ? <Text style={s.error}>{errors.prioridad}</Text> : null}

      {/* Asunto */}
      <Text style={s.label}>Asunto *</Text>
      <TextInput
        value={form.asunto}
        onChangeText={(v) => setForm((f) => ({ ...f, asunto: v }))}
        onBlur={() => setTouched((t) => ({ ...t, asunto: true }))}
        placeholder="Ej: No enciende el equipo del aula 301"
        placeholderTextColor="#94a3b8"
        style={s.input}
        maxLength={200}
      />
      <Text style={s.hint}>{form.asunto.length}/200</Text>
      {touched.asunto && errors.asunto ? <Text style={s.error}>{errors.asunto}</Text> : null}

      {/* Descripción */}
      <Text style={s.label}>Descripción *</Text>
      <TextInput
        value={form.descripcion}
        onChangeText={(v) => setForm((f) => ({ ...f, descripcion: v }))}
        onBlur={() => setTouched((t) => ({ ...t, descripcion: true }))}
        placeholder="Describe el problema con detalle (mín. 10 caracteres)"
        placeholderTextColor="#94a3b8"
        style={[s.input, s.textarea]}
        multiline
        numberOfLines={5}
        maxLength={5000}
      />
      <Text style={s.hint}>{form.descripcion.length}/5000</Text>
      {touched.descripcion && errors.descripcion ? <Text style={s.error}>{errors.descripcion}</Text> : null}

      <Pressable onPress={onSubmit} disabled={submitting} style={[s.button, submitting && { opacity: 0.6 }]}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Crear solicitud</Text>}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { color: theme.colors.muted, fontSize: 12 },
  container: { padding: 16, gap: 6, backgroundColor: theme.colors.bg },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.primary },
  subtitle: { fontSize: 12, color: theme.colors.muted, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.primary, marginTop: 12 },
  group: { marginTop: 6 },
  groupTitle: { fontSize: 11, fontWeight: '600', color: theme.colors.muted, textTransform: 'capitalize', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, color: theme.colors.primary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  hint: { fontSize: 10, color: theme.colors.muted, textAlign: 'right' },
  error: { fontSize: 11, color: theme.colors.danger },
  button: {
    marginTop: 16,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
