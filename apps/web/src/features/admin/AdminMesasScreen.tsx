// RF-29 / RF-30 — Admin: crear y gestionar mesas (dependencias)
// Stitch tokens: #0E87E2 / #FD7C06 / bg #F6F8FB / surface #FFF / border #E2E8F0
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Card, theme, type Mesa, listMesasPaginated, createMesa, updateMesa, setMesaActiva, validateCreateMesa, validateUpdateMesa, FeedbackModal } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

const PAGE_SIZE = 20;

export function AdminMesasScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [activa, setActiva] = useState<boolean | 'todos'>('todos');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editMesa, setEditMesa] = useState<Mesa | null>(null);
  const [nombreNew, setNombreNew] = useState('');
  const [nombreEdit, setNombreEdit] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ visible: boolean; variant: 'success' | 'error' | 'info'; title: string; message?: string } | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Mesa | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setQDeb(q.trim()), 320);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [q]);

  const fetchPage = useCallback(async (targetPage: number, opts: { reset?: boolean } = {}) => {
    const first = targetPage === 0;
    if (first) setLoading(true); else setLoadingMore(true);
    setErrorMsg(null);
    try {
      const res = await listMesasPaginated(supabase, {
        search: qDeb || undefined,
        activa: activa as never,
        page: targetPage + 1,
        pageSize: PAGE_SIZE,
      });
      setTotal(res.count);
      setHasMore(res.data.length === PAGE_SIZE);
      setPage(targetPage);
      setMesas((prev) => (opts.reset || first ? res.data : [...prev, ...res.data]));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [qDeb, activa]);

  useEffect(() => { fetchPage(0, { reset: true }); }, [fetchPage]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchPage(0, { reset: true }); }, [fetchPage]);
  const onEndReached = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchPage(page + 1);
  }, [loadingMore, loading, hasMore, page, fetchPage]);

  const hasActiveFilters = !!qDeb || activa !== 'todos';
  const clearFilters = () => { setQ(''); setActiva('todos'); };

  const toggleActiva = (m: Mesa) => setConfirmToggle(m);
  const doToggleActiva = async () => {
    if (!confirmToggle) return;
    setToggleLoading(true);
    try {
      const upd = await setMesaActiva(supabase, confirmToggle.id, !confirmToggle.activa);
      setMesas((prev) => prev.map((x) => (x.id === confirmToggle.id ? upd : x)));
      setFeedback({ visible: true, variant: 'success', title: confirmToggle.activa ? 'Mesa desactivada' : 'Mesa activada', message: upd.nombre });
      setConfirmToggle(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setFeedback({ visible: true, variant: 'error', title: 'Error al cambiar estado', message: msg });
    } finally { setToggleLoading(false); }
  };

  const submitCreate = async () => {
    const errs = validateCreateMesa({ nombre: nombreNew });
    if (Object.keys(errs).length) { setFormError(Object.values(errs).join(' · ')); return; }
    setSaving(true); setFormError(null);
    try {
      const created = await createMesa(supabase, { nombre: nombreNew });
      setCreateOpen(false); setNombreNew('');
      setMesas((prev) => [created, ...prev]); setTotal((n) => n + 1);
      setFeedback({ visible: true, variant: 'success', title: 'Mesa creada', message: created.nombre });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); setFormError(msg); setFeedback({ visible: true, variant: 'error', title: 'Error al crear mesa', message: msg }); } finally { setSaving(false); }
  };

  const openEdit = (m: Mesa) => { setEditMesa(m); setNombreEdit(m.nombre); setFormError(null); };
  const submitEdit = async () => {
    if (!editMesa) return;
    const errs = validateUpdateMesa({ nombre: nombreEdit });
    if (Object.keys(errs).length) { setFormError(Object.values(errs).join(' · ')); return; }
    const trimmed = nombreEdit.trim();
    if (trimmed === editMesa.nombre) { setEditMesa(null); return; }
    setSaving(true); setFormError(null);
    try {
      const upd = await updateMesa(supabase, editMesa.id, { nombre: trimmed });
      setMesas((prev) => prev.map((x) => (x.id === upd.id ? upd : x)));
      setEditMesa(null);
      setFeedback({ visible: true, variant: 'success', title: 'Mesa actualizada', message: upd.nombre });
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); setFormError(msg); setFeedback({ visible: true, variant: 'error', title: 'Error al actualizar', message: msg }); } finally { setSaving(false); }
  };

  const renderItem = ({ item }: { item: Mesa }) => (
    <Card style={s.card}>
      <View style={s.cardTop}>
        <Text style={s.cardId}>#{item.id}</Text>
        <View style={[s.activaPill, item.activa ? s.activaOn : s.activaOff]}>
          <Text style={[s.activaText, item.activa ? s.activaTextOn : s.activaTextOff]}>{item.activa ? 'Activa' : 'Inactiva'}</Text>
        </View>
      </View>
      <Text style={s.name} numberOfLines={2}>{item.nombre}</Text>
      <View style={s.actions}>
        <Pressable onPress={() => openEdit(item)} style={s.btnGhost} accessibilityRole="button"><Text style={s.btnGhostText}>Editar</Text></Pressable>
        <Pressable onPress={() => toggleActiva(item)} style={[s.btnGhost, !item.activa && s.btnGhostAccent]} accessibilityRole="button">
          <Text style={[s.btnGhostText, !item.activa && { color: theme.colors.primary }]}>{item.activa ? 'Desactivar' : 'Activar'}</Text>
        </Pressable>
      </View>
    </Card>
  );

  if (loading && mesas.length === 0) {
    return <View style={s.center}><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando mesas…</Text>{errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}</View>;
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={s.kickerRow}><View style={s.kickerDot} /><Text style={s.kicker}>Administrador · RF-29 / RF-30</Text></View>
        <View style={s.headerRow}>
          <Text style={s.h1}>Mesas · {total}</Text>
          <Pressable onPress={() => { setCreateOpen(true); setFormError(null); }} style={s.btnPrimary} accessibilityRole="button" accessibilityLabel="Crear mesa"><Text style={s.btnPrimaryText}>+ Nueva mesa</Text></Pressable>
        </View>
        <Text style={s.subtitle}>Crear y gestionar mesas (dependencias). Ver todas las mesas y su configuración (RF-30). Requiere rol administrador (RLS mesa:write).</Text>
        {errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}
      </View>

      <View style={s.filterCard}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre…" placeholderTextColor={theme.colors.mutedSoft} style={s.search} returnKeyType="search" accessibilityLabel="Buscar mesas" />
          {!!q && <Pressable onPress={() => setQ('')} style={s.clearBtn}><Text style={s.clearText}>×</Text></Pressable>}
        </View>
        <View style={s.chipsBlock}>
          <Text style={s.chipsLabel}>Estado</Text>
          <View style={s.chipsRow}>
            {(['todos', true, false] as const).map((v) => (
              <Pressable key={String(v)} onPress={() => setActiva(v as never)} style={[s.chip, activa === v && s.chipActive]} accessibilityState={{ selected: activa === v }}>
                <Text style={[s.chipText, activa === v && s.chipTextActive]}>{v === 'todos' ? 'Todas' : v ? 'Activas' : 'Inactivas'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={s.filterFooter}>
          <Text style={s.filterCount}>{total} resultados{hasActiveFilters ? ' · filtrado' : ''}</Text>
          {hasActiveFilters ? <Pressable onPress={clearFilters} style={s.linkBtn}><Text style={s.linkText}>Limpiar filtros</Text></Pressable> : null}
        </View>
      </View>

      <FlatList
        data={mesas}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        numColumns={isWide ? 2 : 1}
        key={isWide ? 'grid-2' : 'list-1'}
        columnWrapperStyle={isWide ? { gap: 12 } : undefined}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>Sin mesas</Text><Text style={s.mutedCenter}>Ajusta filtros o crea la primera mesa.</Text></View>}
        ListFooterComponent={loadingMore ? <View style={{ padding: 16, alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} /></View> : null}
        contentContainerStyle={s.listContent}
      />

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nueva mesa · RF-29</Text>
            <Text style={s.modalHint}>Nombre único, 3–60 caracteres. RLS: solo administrador.</Text>
            <TextInput value={nombreNew} onChangeText={setNombreNew} placeholder="Nombre (ej: Oficina TIC) *" style={s.input} placeholderTextColor={theme.colors.mutedSoft} autoFocus />
            {formError ? <Text style={s.error}>{formError}</Text> : null}
            <View style={s.modalActions}>
              <Pressable onPress={() => setCreateOpen(false)} style={s.btnGhost}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
              <Pressable onPress={submitCreate} style={[s.btnPrimary, saving && { opacity: 0.6 }]} disabled={saving}><Text style={s.btnPrimaryText}>{saving ? 'Guardando…' : 'Crear'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editMesa} transparent animationType="fade" onRequestClose={() => setEditMesa(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Editar · #{editMesa?.id}</Text>
            <TextInput value={nombreEdit} onChangeText={setNombreEdit} placeholder="Nombre" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />
            {formError ? <Text style={s.error}>{formError}</Text> : null}
            <View style={s.modalActions}>
              <Pressable onPress={() => setEditMesa(null)} style={s.btnGhost}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
              <Pressable onPress={submitEdit} style={[s.btnPrimary, saving && { opacity: 0.6 }]} disabled={saving}><Text style={s.btnPrimaryText}>{saving ? 'Guardando…' : 'Guardar'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {feedback ? <FeedbackModal visible={feedback.visible} variant={feedback.variant as never} title={feedback.title} message={feedback.message} onClose={() => setFeedback(null)} onConfirm={() => setFeedback(null)} /> : null}
      <FeedbackModal visible={!!confirmToggle} variant="confirm" title={confirmToggle?.activa ? 'Desactivar mesa' : 'Activar mesa'} message={confirmToggle ? `¿${confirmToggle.activa ? 'Desactivar' : 'Activar'} "${confirmToggle.nombre}"?` : undefined} confirmText={confirmToggle?.activa ? 'Desactivar' : 'Activar'} cancelText="Cancelar" loading={toggleLoading} onConfirm={doToggleActiva} onClose={() => setConfirmToggle(null)} onCancel={() => setConfirmToggle(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.bg, padding: 24 },
  muted: { color: theme.colors.muted, fontSize: 12 },
  mutedCenter: { color: theme.colors.muted, fontSize: 12, textAlign: 'center' },
  error: { color: theme.colors.danger, fontSize: 11, fontWeight: '600' },
  header: { paddingHorizontal: theme.space[4], paddingTop: theme.space[4], paddingBottom: theme.space[3], gap: theme.space[2] - 2 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  kickerDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.primary },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: theme.colors.muted, textTransform: 'uppercase' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space[3] },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4, flex: 1 },
  subtitle: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  btnPrimary: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, height: 40, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  filterCard: { marginHorizontal: theme.space[3], marginBottom: theme.space[3], gap: theme.space[3], backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.space[4], borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radius.sm, paddingHorizontal: theme.space[3], height: 44 },
  searchIcon: { color: theme.colors.mutedSoft, marginRight: 8, fontSize: 14 },
  search: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  clearBtn: { padding: 6, marginLeft: 6 },
  clearText: { fontSize: 18, color: theme.colors.muted, fontWeight: '600' },
  chipsBlock: { gap: 6 },
  chipsLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.mutedSoft },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, height: 32, justifyContent: 'center', borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  chipTextActive: { color: theme.colors.primaryDark, fontWeight: '700' },
  filterFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: theme.space[2], borderTopWidth: 1, borderTopColor: theme.colors.border },
  filterCount: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  linkBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  linkText: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  listContent: { padding: theme.space[3], gap: 10, paddingBottom: theme.space[6] },
  card: { gap: 8, flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardId: { fontSize: 10, fontWeight: '700', color: theme.colors.mutedSoft },
  activaPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  activaOn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  activaOff: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  activaText: { fontSize: 10, fontWeight: '700' },
  activaTextOn: { color: '#15803D' },
  activaTextOff: { color: '#991B1B' },
  name: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnGhost: { flex: 1, height: 36, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  btnGhostAccent: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  btnGhostText: { fontSize: 11, fontWeight: '700', color: theme.colors.text },
  empty: { alignItems: 'center', padding: theme.space[8], gap: 10, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginTop: theme.space[2] },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.space[4], gap: 12, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  modalHint: { fontSize: 11, color: theme.colors.muted, lineHeight: 14 },
  input: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, paddingHorizontal: 12, height: 44, fontSize: 13, color: theme.colors.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
});
