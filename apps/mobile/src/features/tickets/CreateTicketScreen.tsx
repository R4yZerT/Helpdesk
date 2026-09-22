// RF-06 — Crear solicitud: descripción primero → IA sugiere dependencia + categoría → prioridad bloqueada
// La IA no sugiere técnico: el ticket entra a la cola de la dependencia.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  createTicket,
  fetchCategorias,
  fetchMesas,
  validateCreateTicket,
  validateAdjunto,
  ADJUNTO_MAX_COUNT,
  getPrioridadPorCategoria,
  resolverMesaId,
  predecirCategoria,
  listTecnicosPorMesa,
  registrarSugerenciaIa,
  type CreateTicketInput,
  type PrediccionCategoria,
  type Mesa,
  type TicketCategoria,
  type TecnicoDeMesa,
} from '@helpdesk/shared';
import { theme } from '@helpdesk/shared';
import { Card, Divider, useFeedback } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { TicketForm } from './components/TicketForm';
import { AdjuntoPicker } from './components/AdjuntoPicker';
import { IaSugerenciaPanel } from './components/IaSugerenciaPanel';

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
    tecnicoAsignadoId: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateTicketInput, string>>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sugerencia, setSugerencia] = useState<PrediccionCategoria | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  // Si el usuario elige dependencia/categoría manualmente, la IA no debe sobrescribir.
  const eleccionManualRef = useRef(false);
  const [tecnicosMesa, setTecnicosMesa] = useState<TecnicoDeMesa[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [adjuntos, setAdjuntos] = useState<{ name: string; size: number; type: string; file: Blob }[]>([]);
  const [adjuntoError, setAdjuntoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fb = useFeedback();

  const load = useCallback(async () => {
    setLoadingCats(true);
    try {
      const [cats, ms] = await Promise.all([fetchCategorias(supabase), fetchMesas(supabase)]);
      setCategorias(cats);
      setMesas(ms);
    } catch (e) {
      fb.show('Error', e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setLoadingCats(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Técnicos disponibles de la dependencia seleccionada (para confirmar/cambiar)
  useEffect(() => {
    if (form.mesaId == null) { setTecnicosMesa([]); return; }
    let alive = true;
    listTecnicosPorMesa(supabase, form.mesaId)
      .then((t) => { if (alive) setTecnicosMesa(t.filter((x) => x.activo)); })
      .catch(() => { if (alive) setTecnicosMesa([]); });
    return () => { alive = false; };
  }, [form.mesaId]);

  // IA: analiza asunto+descripcion con debounce 800ms, min 20 chars.
  // BETO primero (micro-API), reglas locales como fallback. Solo auto-aplica si el
  // usuario aún no eligió dependencia/categoría; nunca sugiere técnico.
  useEffect(() => {
    if (!categorias.length || !mesas.length) return;
    const texto = `${form.asunto} ${form.descripcion}`.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (texto.length < 20) {
      setSugerencia(null);
      eleccionManualRef.current = false;
      setIaLoading(false);
      return;
    }
    setIaLoading(true);
    let cancelado = false;
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const res = await predecirCategoria(texto, { categorias, mesas });
        if (cancelado) return;
        setSugerencia(res);
        setIaLoading(false);
        if (res && !eleccionManualRef.current) {
          setForm(f => (f.categoriaId || f.mesaId != null)
            ? f
            : { ...f, categoriaId: res.categoriaId, prioridad: res.prioridad, mesaId: res.mesaId });
        }
      })();
    }, 800);
    return () => { cancelado = true; if (debounceRef.current) clearTimeout(debounceRef.current); };
    // Deps intencionales: solo re-evaluar IA al cambiar texto o catálogos (form/mesas completos causarían loops).
  }, [form.asunto, form.descripcion, categorias, mesas]);

  const humanizeError = (msg: string) => {
    if (/row-level security|violates.*policy|not.*authorized/i.test(msg)) return 'No autorizado — verifica tu sesión y permisos';
    if (/usuario_id requerido/i.test(msg)) return 'Sesión expirada — inicia sesión de nuevo';
    if (/mesa_id.*not-null|dependencia/i.test(msg)) return 'Selecciona una dependencia válida';
    return msg;
  };

  const resetTrasCrear = () => {
    setForm({ categoriaId: 0, asunto: '', descripcion: '', prioridad: 'media', mesaId: null, tecnicoAsignadoId: null });
    setAdjuntos([]); setErrors({}); setTouched({}); setSugerencia(null); eleccionManualRef.current = false; navigation?.goBack?.();
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

  // QA-C2 — picker nativo (iOS/Android): el <input type="file"> no existe en nativo.
  // Mismos tipos y topes que en web (RF-07); el Blob resultante sube igual a Storage.
  const onPickNative = async () => {
    try {
      setAdjuntoError(null);
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      });
      if (res.canceled || !res.assets?.length) return;
      if (adjuntos.length + res.assets.length > ADJUNTO_MAX_COUNT) {
        setAdjuntoError(`Máximo ${ADJUNTO_MAX_COUNT} archivos`);
        return;
      }
      const next: typeof adjuntos = [...adjuntos];
      for (const asset of res.assets) {
        const blob = await (await fetch(asset.uri)).blob();
        const name = asset.name ?? asset.uri.split('/').pop() ?? `adjunto-${Date.now()}`;
        const type = asset.mimeType ?? blob.type ?? 'application/octet-stream';
        const size = blob.size || asset.size || 0;
        const err = validateAdjunto({ name, size, type });
        if (err) { setAdjuntoError(`${name}: ${err}`); return; }
        next.push({ name, size, type, file: blob });
      }
      setAdjuntos(next);
    } catch (e) {
      setAdjuntoError(e instanceof Error ? e.message : 'No se pudo abrir el selector de archivos');
    }
  };

  const onSelectCategoria = (c: TicketCategoria) => {
    eleccionManualRef.current = true;
    setForm(f => ({
      ...f,
      categoriaId: c.id,
      prioridad: getPrioridadPorCategoria(c.id, categorias),
      mesaId: resolverMesaId(c.dominio, mesas),
      tecnicoAsignadoId: null,
    }));
  };

  const aplicarSugerencia = () => {
    if (!sugerencia) return;
    eleccionManualRef.current = true;
    setForm(f => ({
      ...f,
      categoriaId: sugerencia.categoriaId,
      prioridad: sugerencia.prioridad,
      mesaId: sugerencia.mesaId,
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
      // Guarda la sugerencia IA vista al crear — el trigger crea la fila pendiente,
      // aquí se completa con mesa/categoría sugeridas para el loop de validación.
      try {
        if (sugerencia) {
          await registrarSugerenciaIa(supabase, res.id, {
            mesaId: sugerencia.mesaId ?? null,
            categoriaId: sugerencia.categoriaId ?? null,
            confianza: sugerencia.confianza ?? null,
            fuente: sugerencia.fuente === 'beto' ? 'beto' : 'reglas',
          });
        }
      } catch (fbErr) {
        console.warn('[CreateTicket] feedback IA no guardado', fbErr);
      }
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
        const msg = `Ticket #${res.numero} creado, pero falló la subida de: ${adjuntosFailed.join(', ')}`;
        setAdjuntoError(msg);
        fb.show(adjuntosFailed.length === adjuntos.length ? 'Ticket creado — adjuntos fallaron' : 'Algunos adjuntos fallaron', msg, 'warning', { onConfirm: resetTrasCrear });
        return;
      }
      fb.show('Solicitud creada', `Ticket #${res.numero} creado correctamente`, 'success', { onConfirm: resetTrasCrear });
    } catch (e) {
      const msg = humanizeError(e instanceof Error ? e.message : String(e));
      console.error('[CreateTicket] error', e);
      setSubmitError(msg);
      fb.show('Error al crear', msg, 'error');
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

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" style={s.bg}>
      <View style={s.breadcrumb}><Text style={s.breadcrumbText}>Inicio / Mis Solicitudes / Nueva</Text></View>

      <View style={[s.formWrap, isWide && { maxWidth: 680, alignSelf: 'center', width: '100%' }]}>
        <Card style={s.formCard}>
          <TicketForm
            form={form}
            errors={errors}
            touched={touched}
            categorias={categorias}
            mesas={mesas}
            tecnicosMesa={tecnicosMesa}
            sugerencia={sugerencia}
            iaLoading={iaLoading}
            onChange={setForm}
            onTouched={setTouched}
            onSelectCategoria={onSelectCategoria}
            onApplySugerencia={aplicarSugerencia}
          />

          <IaSugerenciaPanel
            sugerencia={sugerencia}
            iaLoading={iaLoading}
            sugerenciaCat={sugerencia ? categorias.find(c => c.id === sugerencia.categoriaId) : undefined}
            isSugerenciaAplicada={sugerencia ? form.categoriaId === sugerencia.categoriaId : false}
            iaFuente={sugerencia?.fuente === 'beto' ? 'modelo BETO' : 'reglas locales'}
            onApply={aplicarSugerencia}
          />

          <Divider />

          {/* Adjuntos */}
          <AdjuntoPicker
            adjuntos={adjuntos}
            adjuntoError={adjuntoError}
            fileInputRef={fileInputRef}
            onPickFiles={onPickFiles}
            onPickNative={onPickNative}
            onRemove={(i) => setAdjuntos(prev => prev.filter((_, idx) => idx !== i))}
            onAdjuntoError={setAdjuntoError}
          />

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
              {submitting ? <ActivityIndicator color={theme.colors.inkOnAccent} /> : <Text style={s.submitText}>Crear solicitud</Text>}
            </Pressable>
          </View>
        </Card>
      </View>
      {fb.modal}
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
  title: { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  alertErr: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10 },
  alertErrText: { color: '#991B1B', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 14 },
  btnGhost: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  btnGhostText: { color: theme.colors.textSoft, fontWeight: '700', fontSize: 12 },
  submit: { flex: 1.2, backgroundColor: theme.colors.accent, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA' },
  submitText: { color: theme.colors.inkOnAccent, fontWeight: '800', letterSpacing: 0.3, fontSize: 13 },
  footnote: { fontSize: 10, color: theme.colors.mutedSoft, textAlign: 'center', fontWeight: '600' },
  btnPrimary: { marginTop: 4, backgroundColor: theme.colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: theme.radius.full },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});