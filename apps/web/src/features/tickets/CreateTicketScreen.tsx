// RF-06 — Crear solicitud: descripción primero → IA sugiere categoría → prioridad bloqueada por categoría
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
  createTicket,
  fetchCategorias,
  fetchMesas,
  validateCreateTicket,
  validateAdjunto,
  ADJUNTO_MAX_COUNT,
  getPrioridadPorCategoria,
  getMesaIdPorDominio,
  classifyLocal,
  type CreateTicketInput,
  type Clasificacion,
  type Mesa,
  type TicketCategoria,
} from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { Card, Badge, Divider, FeedbackModal, FilterDropdown } from '@helpdesk/shared';
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [adjuntos, setAdjuntos] = useState<{ name: string; size: number; type: string; file: File }[]>([]);
  const [adjuntoError, setAdjuntoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [feedback, setFeedback] = useState<{ visible: boolean; variant: 'success' | 'error' | 'info'; title: string; message?: string; onOk?: () => void }>(
    { visible: false, variant: 'info', title: '' },
  );

  const load = useCallback(async () => {
    setLoadingCats(true);
    try {
      const [cats, ms] = await Promise.all([fetchCategorias(supabase), fetchMesas(supabase)]);
      setCategorias(cats);
      setMesas(ms);
    } catch (e) {
      setFeedback({ visible: true, variant: 'error', title: 'Error al cargar catálogos', message: e instanceof Error ? e.message : String(e) });
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
      // auto-preseleccionar categoría + dependencia en cada predicción
      if (res) {
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

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    setAdjuntoError(null);
    const arr = Array.from(files);
    if (adjuntos.length + arr.length > ADJUNTO_MAX_COUNT) {
      setAdjuntoError(`Máximo ${ADJUNTO_MAX_COUNT} archivos`);
      return;
    }
    const next: typeof adjuntos = [...adjuntos];
    for (const f of arr) {
      const err = validateAdjunto({ name: f.name, size: f.size, type: f.type });
      if (err) { setAdjuntoError(`${f.name}: ${err}`); return; }
      next.push({ name: f.name, size: f.size, type: f.type || 'image/jpeg', file: f });
    }
    setAdjuntos(next);
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
    setSubmitError(null);
    const errs = validateCreateTicket(form);
    setErrors(errs);
    setTouched({ categoriaId: true, asunto: true, descripcion: true, prioridad: true, mesaId: true });
    if (Object.keys(errs).length > 0) {
      setSubmitError(Object.values(errs)[0] ?? 'Revisa los campos marcados');
      return;
    }
    setSubmitting(true);
    try {
      console.log('[CreateTicket] submit', form);
      const { data: { user } } = await supabase.auth.getUser();
      const res = await createTicket(supabase, form);
      // Subir adjuntos si hay (RF-07) — ticket ya creado, informar fallos sin revertir
      const adjuntosFailed: string[] = [];
      if (adjuntos.length) {
        for (const a of adjuntos) {
          try {
            const path = `${res.id}/${Date.now()}-${a.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const { error: upErr } = await supabase.storage.from('ticket-adjuntos').upload(path, a.file, { contentType: a.type, upsert: false });
            if (upErr) throw upErr;
            const { error: insErr } = await supabase.from('ticket_adjuntos').insert({ ticket_id: res.id, storage_path: path, nombre_original: a.name, mime: a.type, tamano_bytes: a.size, subido_por: user?.id ?? null });
            if (insErr) throw insErr;
          } catch (upE) {
            console.warn('[CreateTicket] adjunto fail', a.name, upE);
            adjuntosFailed.push(a.name);
          }
        }
      }
      if (adjuntosFailed.length) {
        const msg = `Ticket #${res.numero} creado, pero falló la subida de: ${adjuntosFailed.join(', ')}. Reintenta desde el detalle.`;
        setAdjuntoError(msg);
        setFeedback({
          visible: true,
          variant: 'info',
          title: adjuntosFailed.length === adjuntos.length ? 'Ticket creado — adjuntos fallaron' : 'Solicitud creada — algunos adjuntos fallaron',
          message: msg,
        });
        // limpiar formulario pero dejar visible el error de adjuntos
        setForm({ categoriaId: 0, asunto: '', descripcion: '', prioridad: 'media', mesaId: null });
        setAdjuntos([]);
        setErrors({});
        setTouched({});
        setSugerencia(null);
        return;
      }
      setFeedback({
        visible: true,
        variant: 'success',
        title: 'Solicitud creada',
        message: `Ticket #${res.numero} creado correctamente · Prioridad ${form.prioridad} · Mesa ${mesas.find(m => m.id === form.mesaId)?.nombre ?? form.mesaId}`,
        onOk: () => {
          setForm({ categoriaId: 0, asunto: '', descripcion: '', prioridad: 'media', mesaId: null });
          setAdjuntos([]);
          setErrors({});
          setTouched({});
          setSugerencia(null);
          setFeedback((f) => ({ ...f, visible: false }));
          navigation?.goBack?.();
        },
      });
    } catch (e) {
      const msg = humanizeError(e instanceof Error ? e.message : String(e));
      console.error('[CreateTicket] error', e);
      setSubmitError(msg);
      setFeedback({ visible: true, variant: 'error', title: 'Error al crear solicitud', message: msg });
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

  const prioridadTone = form.prioridad === 'critica' ? 'accent' : form.prioridad === 'alta' ? 'danger' : form.prioridad === 'media' ? 'warning' : 'muted';
  const sugerenciaCat = sugerencia ? categorias.find(c => c.id === sugerencia.categoriaId) : null;
  const isSugerenciaAplicada = sugerencia ? form.categoriaId === sugerencia.categoriaId : false;
  // opciones para desplegables — mismo componente que en mesas/dependencias; categoría depende de dependencia
  const mesaOptions = mesas.map(m => ({ value: m.id, label: m.nombre }));
  const categoriaOptions = (form.mesaId
    ? categorias.filter(c => getMesaIdPorDominio(c.dominio) === form.mesaId)
    : []
  ).map(c => ({ value: c.id, label: `${c.subcategoria} · ${c.dominio}` }));

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" style={s.bg}>
      <View style={s.breadcrumb}><Text style={s.breadcrumbText}>Inicio / Mis Solicitudes / Nueva</Text></View>

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
            placeholder="Describe el problema con detalle (mín. 20 caracteres para activar la IA). Ej: El wifi del bloque 3 se cae cada 10 min desde ayer"
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

          {/* Dependencia y Categoría — mismos desplegables que en mesas/dependencias */}
          <View style={s.dropdownRow}>
            <FilterDropdown<number>
              label="Dependencia *"
              value={form.mesaId ?? ''}
              options={mesaOptions}
              placeholder="Seleccionar dependencia"
              onSelect={(v) => {
                const id = v === '' ? null : Number(v);
                setForm(f => {
                  // si cambia dependencia, limpia categoría que no pertenece a esa mesa
                  const keepCat = f.categoriaId ? categorias.find(c => c.id === f.categoriaId) : null;
                  const keep = keepCat && getMesaIdPorDominio(keepCat.dominio) === id ? f.categoriaId : 0;
                  return { ...f, mesaId: id, categoriaId: keep, prioridad: keep ? getPrioridadPorCategoria(keep) : f.prioridad };
                });
                setTouched(t => ({ ...t, mesaId: true }));
              }}
            />
            <FilterDropdown<number>
              label="Categoría *"
              value={form.categoriaId || ''}
              options={categoriaOptions}
              placeholder={form.mesaId ? 'Seleccionar categoría' : 'Elige dependencia primero'}
              onSelect={(v) => {
                if (v === '') { setForm(f => ({ ...f, categoriaId: 0 })); return; }
                const cat = categorias.find(c => c.id === Number(v));
                if (cat) onSelectCategoria(cat);
                else setForm(f => ({ ...f, categoriaId: Number(v) }));
                setTouched(t => ({ ...t, categoriaId: true }));
              }}
            />
          </View>
          <Text style={s.sectionHint}>IA preselecciona ambas — puedes cambiar cualquiera. Al cambiar categoría, prioridad y dependencia se recalculan.</Text>
          {touched.categoriaId && errors.categoriaId ? <Text style={s.error}>{errors.categoriaId}</Text> : null}
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

          {/* Adjuntos RF-07 imágenes + PDF/DOCX — clic abre picker */}
          <Pressable onPress={() => (fileInputRef.current as unknown as HTMLInputElement | null)?.click?.()} style={s.dropZone} accessibilityRole="button" accessibilityLabel="Seleccionar adjuntos">
            <Text style={s.dropIcon}>⤒</Text>
            <Text style={s.dropTitle}>Adjuntos (opcional) — tocar para cargar</Text>
            <Text style={s.dropSub}>Imágenes, PDF o Word (DOC/DOCX) · 10 MB máx · 5 máx {adjuntos.length ? `· ${adjuntos.length} seleccionado(s)` : ''}</Text>
          </Pressable>
          {/* input web nativo oculto */}
          <View style={{ display: 'none' } as unknown as object}>
            {/* @ts-ignore web only */}
            <input
              ref={fileInputRef as unknown as never}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.doc,.docx"
              multiple
              onChange={(e: { target: { files: FileList | null; value: string } }) => { onPickFiles(e.target.files); e.target.value = ''; }}
            />
          </View>
          {adjuntoError ? <Text style={s.error}>{adjuntoError}</Text> : null}
          {adjuntos.length ? (
            <View style={s.adjList}>
              {adjuntos.map((a, i) => (
                <View key={`${a.name}-${i}`} style={s.adjRow}>
                  <Text style={s.adjName} numberOfLines={1}>{a.name} · {(a.size/1024).toFixed(0)} KB</Text>
                  <Pressable onPress={() => setAdjuntos(prev => prev.filter((_, idx) => idx !== i))} style={s.adjRemove}><Text style={s.adjRemoveText}>Quitar</Text></Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {submitError ? <View style={s.alertErr}><Text style={s.alertErrText}>{submitError}</Text></View> : null}
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
        </Card>
      </View>
      <FeedbackModal
        visible={feedback.visible}
        variant={feedback.variant}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback((f) => ({ ...f, visible: false }))}
        onConfirm={() => { const cb = feedback.onOk; if (cb) cb(); else setFeedback((f) => ({ ...f, visible: false })); }}
      />
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
  dropdownRow: { flexDirection:'row', gap: 10, flexWrap:'wrap' as const },
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
  mesaCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, width: '31%' as unknown as number, minWidth: 140, flexGrow: 0, flexShrink: 0 },
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
  alertErr: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10 },
  alertErrText: { color: '#991B1B', fontSize: 12, fontWeight: '700' },
  adjList: { gap: 6 },
  adjRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  adjName: { fontSize: 11, color: theme.colors.textSoft, flex: 1, fontWeight: '600' },
  adjRemove: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  adjRemoveText: { fontSize: 10, color: theme.colors.danger, fontWeight: '700' },
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
