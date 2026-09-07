// RF-06 — Crear solicitud: descripción primero → IA sugiere categoría → prioridad bloqueada por categoría
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
  createTicket,
  fetchCategorias,
  fetchMesas,
  validateCreateTicket,
  getPrioridadPorCategoria,
  getMesaIdPorDominio,
  classifyLocal,
  type CreateTicketInput,
  type Clasificacion,
  type Mesa,
  type TicketCategoria,
} from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { Card, Badge, Divider } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

export function CreateTicketScreen({ navigation }: { navigation?: { goBack: () => void; navigate: (s: string) => void } }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;
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
  const [sugerencia, setSugerencia] = useState<Clasificacion | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // IA: analiza asunto+descripcion con debounce 800ms, min 20 chars
  useEffect(() => {
    if (!categorias.length) return;
    const texto = `${form.asunto} ${form.descripcion}`.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (texto.length < 20) {
      setSugerencia(null);
      setIaLoading(false);
      return;
    }
    setIaLoading(true);
    debounceRef.current = setTimeout(() => {
      const res = classifyLocal(texto, categorias);
      setSugerencia(res);
      setIaLoading(false);
      // auto-aplicar solo si aún no hay categoría elegida
      if (res && form.categoriaId === 0) {
        const cat = categorias.find(c => c.id === res.categoriaId);
        setForm(f => ({
          ...f,
          categoriaId: res.categoriaId,
          prioridad: res.prioridad,
          mesaId: cat ? getMesaIdPorDominio(cat.dominio) : res.mesaId,
        }));
      }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.asunto, form.descripcion, categorias]);

  const humanizeError = (msg: string) => {
    if (/row-level security|violates.*policy|not.*authorized/i.test(msg)) return 'No autorizado — verifica tu sesión y permisos';
    if (/usuario_id requerido/i.test(msg)) return 'Sesión expirada — inicia sesión de nuevo';
    if (/mesa_id.*not-null|dependencia/i.test(msg)) return 'Selecciona una dependencia válida';
    return msg;
  };

  const onSelectCategoria = (c: TicketCategoria) => {
    setForm(f => ({
      ...f,
      categoriaId: c.id,
      prioridad: getPrioridadPorCategoria(c.id),
      mesaId: getMesaIdPorDominio(c.dominio),
    }));
  };

  const aplicarSugerencia = () => {
    if (!sugerencia) return;
    const cat = categorias.find(c => c.id === sugerencia.categoriaId);
    if (!cat) return;
    setForm(f => ({
      ...f,
      categoriaId: sugerencia.categoriaId,
      prioridad: sugerencia.prioridad,
      mesaId: getMesaIdPorDominio(cat.dominio),
    }));
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
            setSugerencia(null);
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

  const prioridadTone = form.prioridad === 'critica' ? 'accent' : form.prioridad === 'alta' ? 'danger' : form.prioridad === 'media' ? 'warning' : 'muted';
  const sugerenciaCat = sugerencia ? categorias.find(c => c.id === sugerencia.categoriaId) : null;
  const isSugerenciaAplicada = sugerencia ? form.categoriaId === sugerencia.categoriaId : false;

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" style={s.bg}>
      <View style={s.breadcrumb}><Text style={s.breadcrumbText}>Inicio / Mis Solicitudes / Nueva</Text></View>
      <View style={s.hero}>
        <Text style={s.kicker}>Nueva incidencia</Text>
        <Text style={s.h1}>Crear Solicitud de Soporte</Text>
        <Text style={s.subtitle}>Describe el problema: la IA analizará tu texto y sugerirá la categoría. La prioridad se asigna automáticamente.</Text>
      </View>

      <View style={[s.formWrap, isWide && { maxWidth: 680, alignSelf: 'center', width: '100%' }]}>
        <Card style={s.formCard}>
          {/* Paso 1: Asunto + Descripción primero */}
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
            placeholder="Describe el problema con detalle (mín. 20 caracteres para activar la IA). Ej: El wifi del bloque 3 se cae cada 10 min desde ayer..."
            placeholderTextColor={theme.colors.mutedSoft}
            style={[s.input, s.textarea]}
            multiline
            numberOfLines={5}
            maxLength={5000}
          />
          <Text style={s.hint}>{form.descripcion.length}/5000 · {form.descripcion.trim().length < 20 ? `faltan ${20 - form.descripcion.trim().length} caracteres para IA` : 'listo para analizar'}</Text>
          {touched.descripcion && errors.descripcion ? <Text style={s.error}>{errors.descripcion}</Text> : null}

          {/* Bloque IA */}
          <View style={s.iaBlock}>
            {iaLoading ? (
              <View style={s.iaLoading}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={s.iaLoadingText}>Analizando descripción...</Text>
              </View>
            ) : sugerencia && sugerenciaCat ? (
              <View style={s.aiCard}>
                <View style={s.aiHead}>
                  <Text style={s.aiIcon}>✦</Text>
                  <Text style={s.aiTitle}>IA sugiere</Text>
                  <Text style={s.aiPct}>{Math.round(sugerencia.confianza * 100)}%</Text>
                  {isSugerenciaAplicada ? <Badge label="aplicada" tone="success" /> : null}
                </View>
                <Text style={s.aiText}>{sugerenciaCat.subcategoria} · Prioridad {sugerencia.prioridad} · {sugerenciaCat.dominio}</Text>
                <View style={s.aiRow}>
                  {isSugerenciaAplicada ? (
                    <Text style={s.aiApplied}>✓ Categoría y prioridad aplicadas</Text>
                  ) : (
                    <>
                      <Pressable onPress={aplicarSugerencia} style={s.aiBtn}><Text style={s.aiBtnText}>Aplicar sugerencia</Text></Pressable>
                      <Text style={s.aiHint}>o elige otra categoría abajo</Text>
                    </>
                  )}
                </View>
              </View>
            ) : (
              <View style={s.iaIdle}>
                <Text style={s.iaIdleText}>✦ Escribe al menos 20 caracteres: la IA sugerirá la categoría y bloqueará la prioridad.</Text>
              </View>
            )}
          </View>

          <Divider />

          {/* Categoría (corregible) */}
          <Text style={s.sectionTitle}>Categoría *</Text>
          <Text style={s.sectionHint}>Sugerida por IA — puedes corregirla. Al cambiarla, la prioridad se recalcula sola.</Text>
          {Object.entries(byDominio).map(([dominio, cats]) => (
            <View key={dominio} style={s.group}>
              <Text style={s.groupTitle}>{dominio}</Text>
              <View style={s.chips}>
                {cats.map((c) => {
                  const isSug = sugerencia?.categoriaId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => onSelectCategoria(c)}
                      style={[s.chip, form.categoriaId === c.id && s.chipActive, isSug && form.categoriaId !== c.id && s.chipSuggested]}>
                      <Text style={[s.chipText, form.categoriaId === c.id && s.chipTextActive]}>{c.subcategoria}</Text>
                      {isSug ? <Text style={[s.chipSugBadge, form.categoriaId === c.id && { color:'#fff' }]}> IA</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {touched.categoriaId && errors.categoriaId ? <Text style={s.error}>{errors.categoriaId}</Text> : null}

          <Divider />

          {/* Dependencia auto-derivada */}
          <Text style={s.sectionTitle}>Dependencia (mesa) *</Text>
          <Text style={s.sectionHint}>Se asigna según dominio de la categoría. Puedes ajustarla si aplica.</Text>
          <View style={s.mesaGrid}>
            {mesas.slice(0, 4).map((m) => {
              const active = form.mesaId === m.id;
              return (
                <Pressable key={m.id} onPress={() => setForm((f) => ({ ...f, mesaId: m.id }))} style={[s.mesaCard, active && s.mesaCardActive]}>
                  <View style={[s.mesaDot, active && s.mesaDotActive]}><Text style={[s.mesaDotText, active && { color: '#fff' }]}>◈</Text></View>
                  <Text style={[s.mesaName, active && s.mesaNameActive]}>{m.nombre}</Text>
                  {active ? <Text style={s.mesaCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {mesas.length > 4 ? (
            <View style={s.chips}>
              {mesas.slice(4).map((m) => (
                <Pressable key={m.id} onPress={() => setForm((f) => ({ ...f, mesaId: m.id }))} style={[s.chip, form.mesaId === m.id && s.chipActive]}>
                  <Text style={[s.chipText, form.mesaId === m.id && s.chipTextActive]}>{m.nombre}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {touched.mesaId && errors.mesaId ? <Text style={s.error}>{errors.mesaId}</Text> : null}

          <Divider />

          {/* Prioridad bloqueada */}
          <View style={s.prioLockedRow}>
            <Text style={s.sectionTitle}>Prioridad</Text>
            <Badge label={form.prioridad} tone={prioridadTone as any} />
          </View>
          <View style={s.prioLockedBox}>
            <Text style={s.prioLockedText}>Asignada automáticamente por categoría</Text>
            <Text style={s.prioLockedSub}>No editable · {form.prioridad === 'critica' ? 'SLA 60 min' : form.prioridad === 'alta' ? 'SLA 4 h' : form.prioridad === 'media' ? 'SLA 24 h' : 'SLA 72 h'} · Cambia la categoría para recalcular.</Text>
          </View>
          {touched.prioridad && errors.prioridad ? <Text style={s.error}>{errors.prioridad}</Text> : null}

          {/* Adjuntos */}
          <View style={s.dropZone}>
            <Text style={s.dropIcon}>⤒</Text>
            <Text style={s.dropTitle}>Adjuntos (opcional)</Text>
            <Text style={s.dropSub}>Arrastra o toca para subir · 10 MB máx</Text>
          </View>

          {/* Acciones */}
          <View style={s.actions}>
            <Pressable onPress={() => navigation?.goBack?.()} style={s.btnGhost}><Text style={s.btnGhostText}>Cancelar y volver</Text></Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Crear solicitud"
              accessibilityState={{ disabled: submitting }}
              style={({ pressed }) => [s.submit, pressed && { opacity: 0.92 }, submitting && { opacity: 0.6 }]}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Crear solicitud</Text>}
            </Pressable>
          </View>
          <Text style={s.footnote}>Se creará como “abierto” con la prioridad bloqueada por categoría.</Text>
        </Card>
      </View>
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
  breadcrumb: { paddingHorizontal: 2 },
  breadcrumbText: { fontSize: 11, color: theme.colors.mutedSoft, fontWeight: '600' },
  hero: { gap: 6, paddingHorizontal: 2 },
  kicker: { fontSize: 10, letterSpacing: 1.4, color: theme.colors.mutedSoft, fontWeight: '700', textTransform: 'uppercase' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  formWrap: { gap: 12 },
  formCard: { gap: 12, padding: 20, borderRadius: theme.radius.xl },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSoft, letterSpacing: 0.2 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt, minHeight: 44 },
  textarea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 11 },
  hint: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'right', fontWeight: '600' },
  error: { fontSize: 11, color: theme.colors.danger, fontWeight: '600' },
  iaBlock: { minHeight: 44 },
  iaLoading: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor: theme.colors.surfaceAlt, borderWidth:1, borderColor:theme.colors.border, borderRadius:12, padding:12 },
  iaLoadingText: { fontSize:12, color:theme.colors.muted, fontWeight:'600' },
  iaIdle: { backgroundColor:'#F8FAFC', borderWidth:1, borderColor:theme.colors.border, borderStyle:'dashed', borderRadius:12, padding:12 },
  iaIdleText: { fontSize:11, color:theme.colors.muted, fontWeight:'600', lineHeight:16 },
  aiCard: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 12, padding: 12, gap: 6 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiIcon: { color: theme.colors.primary, fontWeight: '800' },
  aiTitle: { fontSize: 11, fontWeight: '800', color: theme.colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  aiPct: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  aiText: { fontSize: 12, color: theme.colors.textSoft, fontWeight: '600' },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  aiBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  aiBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  aiApplied: { fontSize:11, color:theme.colors.success, fontWeight:'700' },
  aiHint: { fontSize:11, color:theme.colors.muted, fontWeight:'600' },
  title: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.text },
  sectionHint: { fontSize: 11, color: theme.colors.muted, marginTop: -6 },
  group: { gap: 6 },
  groupTitle: { fontSize: 10, fontWeight: '700', color: theme.colors.mutedSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection:'row', alignItems:'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipSuggested: { borderColor: theme.colors.primary, borderStyle:'dashed' as const },
  chipText: { fontSize: 12, color: theme.colors.textSoft, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipSugBadge: { fontSize:9, fontWeight:'800', color: theme.colors.primary, marginLeft:4 },
  mesaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mesaCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, minWidth: 140, flex: 1 },
  mesaCardActive: { backgroundColor: '#EFF6FF', borderColor: theme.colors.primary, borderWidth: 2 },
  mesaDot: { width: 28, height: 28, borderRadius: 8, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  mesaDotActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  mesaDotText: { fontSize: 10, color: theme.colors.muted },
  mesaName: { fontSize: 12, fontWeight: '700', color: theme.colors.textSoft, flex: 1 },
  mesaNameActive: { color: theme.colors.primaryDark },
  mesaCheck: { color: theme.colors.primary, fontWeight: '800' },
  prioLockedRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  prioLockedBox: { backgroundColor: theme.colors.surfaceAlt, borderWidth:1, borderColor:theme.colors.border, borderRadius:12, padding:12, gap:2 },
  prioLockedText: { fontSize:12, fontWeight:'700', color:theme.colors.textSoft },
  prioLockedSub: { fontSize:11, color:theme.colors.muted, lineHeight:16 },
  dropZone: { borderWidth: 2, borderColor: theme.colors.borderStrong, borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#F8FAFC', padding: 18, alignItems: 'center', gap: 4 },
  dropIcon: { fontSize: 18, color: theme.colors.mutedSoft },
  dropTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSoft },
  dropSub: { fontSize: 11, color: theme.colors.muted, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 14 },
  btnGhost: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  btnGhostText: { color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 },
  submit: { flex: 1.2, backgroundColor: theme.colors.accent, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA' },
  submitText: { color: '#fff', fontWeight: '800', letterSpacing: 0.3, fontSize: 13 },
  footnote: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'center', fontWeight: '600' },
  btnPrimary: { marginTop: 4, backgroundColor: theme.colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: theme.radius.full },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
