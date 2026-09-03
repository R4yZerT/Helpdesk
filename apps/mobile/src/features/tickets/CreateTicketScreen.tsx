// RF-06 — Crear solicitud (elegante IUE: warm paper, brass, cards)
// Lógica idéntica, solo pulido visual

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
import { Card, Divider } from '@helpdesk/shared';
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

  useEffect(() => { load(); }, [load]);

  const humanizeError = (msg: string) => {
    if (/row-level security|violates.*policy|not.*authorized/i.test(msg)) return 'No autorizado — verifica tu sesión y permisos';
    if (/usuario_id requerido/i.test(msg)) return 'Sesión expirada — inicia sesión de nuevo';
    if (/mesa_id.*not-null|dependencia/i.test(msg)) return 'Selecciona una dependencia válida';
    return msg;
  };

  const onSubmit = async () => {
    const errs = validateCreateTicket(form);
    setErrors(errs);
    setTouched({ categoriaId: true, asunto: true, descripcion: true, prioridad: true, mesaId: true });
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    try {
      const res = await createTicket(supabase, form);
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
      Alert.alert('Error al crear', humanizeError(e instanceof Error ? e.message : String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCats) {
    return (
      <View style={s.center}>
        <Card style={s.loadingCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={s.muted}>Cargando catálogos…</Text>
        </Card>
      </View>
    );
  }

  if (!categorias.length || !mesas.length) {
    return (
      <View style={s.center} accessible accessibilityRole="alert">
        <Card style={s.emptyCard}>
          <Text style={s.title}>Catálogos no disponibles</Text>
          <Text style={s.mutedCenter}>
            {!categorias.length && !mesas.length ? 'Categorías y dependencias vacías' : !categorias.length ? 'Categorías vacías' : 'Dependencias vacías'} — verifica RLS/seed.
          </Text>
          <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Reintentar cargar catálogos" style={s.btnPrimary}>
            <Text style={s.btnPrimaryText}>Reintentar</Text>
          </Pressable>
        </Card>
      </View>
    );
  }

  const byDominio = categorias.reduce<Record<string, TicketCategoria[]>>((acc, c) => {
    (acc[c.dominio] ??= []).push(c);
    return acc;
  }, {});

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" style={s.bg}>
      <View style={s.hero}>
        <Text style={s.kicker}>Nueva solicitud · RF-06</Text>
        <Text style={s.h1}>Crear solicitud</Text>
        <Text style={s.subtitle}>Elige categoría, dependencia y prioridad. Cuanto más claro el asunto, más rápido el triage.</Text>
      </View>

      <Card style={s.card}>
        <Text style={s.sectionTitle}>Categoría *</Text>
        <Text style={s.sectionHint}>Toca una subcategoría. Agrupadas por dominio.</Text>
        {Object.entries(byDominio).map(([dominio, cats]) => (
          <View key={dominio} style={s.group}>
            <Text style={s.groupTitle}>{dominio}</Text>
            <View style={s.chips}>
              {cats.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setForm((f) => ({ ...f, categoriaId: c.id }))}
                  style={[s.chip, form.categoriaId === c.id && s.chipActive]}>
                  <Text style={[s.chipText, form.categoriaId === c.id && s.chipTextActive]}>{c.subcategoria}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {touched.categoriaId && errors.categoriaId ? <Text style={s.error}>{errors.categoriaId}</Text> : null}

        <Divider />

        <Text style={s.sectionTitle}>Dependencia (mesa) *</Text>
        <View style={s.chips}>
          {mesas.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setForm((f) => ({ ...f, mesaId: m.id }))}
              style={[s.chip, form.mesaId === m.id && s.chipActive]}>
              <Text style={[s.chipText, form.mesaId === m.id && s.chipTextActive]}>{m.nombre}</Text>
            </Pressable>
          ))}
        </View>
        {touched.mesaId && errors.mesaId ? <Text style={s.error}>{errors.mesaId}</Text> : null}

        <Divider />

        <Text style={s.sectionTitle}>Prioridad *</Text>
        <View style={s.chips}>
          {PRIORIDADES.map((p) => (
            <Pressable
              key={p}
              onPress={() => setForm((f) => ({ ...f, prioridad: p }))}
              style={[s.chip, form.prioridad === p && s.chipActive]}>
              <Text style={[s.chipText, form.prioridad === p && s.chipTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>
        {touched.prioridad && errors.prioridad ? <Text style={s.error}>{errors.prioridad}</Text> : null}
      </Card>

      <Card style={s.card}>
        <Text style={s.label}>Asunto *</Text>
        <TextInput
          value={form.asunto}
          onChangeText={(v) => setForm((f) => ({ ...f, asunto: v }))}
          onBlur={() => setTouched((t) => ({ ...t, asunto: true }))}
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
          onChangeText={(v) => setForm((f) => ({ ...f, descripcion: v }))}
          onBlur={() => setTouched((t) => ({ ...t, descripcion: true }))}
          placeholder="Describe el problema con detalle (mín. 10 caracteres)"
          placeholderTextColor={theme.colors.mutedSoft}
          style={[s.input, s.textarea]}
          multiline
          numberOfLines={5}
          maxLength={5000}
        />
        <Text style={s.hint}>{form.descripcion.length}/5000</Text>
        {touched.descripcion && errors.descripcion ? <Text style={s.error}>{errors.descripcion}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Crear solicitud"
          accessibilityState={{ disabled: submitting }}
          style={({ pressed }) => [s.submit, pressed && { opacity: 0.92 }, submitting && { opacity: 0.6 }]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Crear solicitud</Text>}
        </Pressable>
        <Text style={s.footnote}>Se creará como “abierto” y quedará disponible en Mis solicitudes.</Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bg: { backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg },
  loadingCard: { alignItems: 'center', gap: 10, padding: 20 },
  emptyCard: { alignItems: 'center', gap: 10, padding: 20 },
  muted: { color: theme.colors.muted, fontSize: 12 },
  mutedCenter: { color: theme.colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  container: { padding: 16, gap: 14, paddingBottom: 28 },
  hero: { gap: 6, paddingHorizontal: 2 },
  kicker: { fontSize: 10, letterSpacing: 1.4, color: theme.colors.mutedSoft, fontWeight: '700', textTransform: 'uppercase' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  card: { gap: 10, padding: 14 },
  title: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.primary },
  sectionHint: { fontSize: 11, color: theme.colors.muted, marginTop: -6 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSoft, letterSpacing: 0.2 },
  group: { gap: 6 },
  groupTitle: { fontSize: 10, fontWeight: '700', color: theme.colors.mutedSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, color: theme.colors.textSoft, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  hint: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'right', fontWeight: '600' },
  error: { fontSize: 11, color: theme.colors.danger, fontWeight: '600' },
  submit: { marginTop: 4, backgroundColor: theme.colors.primary, paddingVertical: 13, borderRadius: theme.radius.full, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '800', letterSpacing: 0.3, fontSize: 13 },
  footnote: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'center', fontWeight: '600' },
  btnPrimary: { marginTop: 4, backgroundColor: theme.colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: theme.radius.full },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
