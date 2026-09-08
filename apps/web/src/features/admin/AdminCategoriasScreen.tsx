// RF-32 — Admin: categorías maestras ticket_categories
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Card, theme, type TicketCategoria, DOMINIOS, type DominioCategoria, listCategoriasPaginated, createCategoria, updateCategoria, setCategoriaActiva, validateCreateCategoria, validateUpdateCategoria } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

const PAGE_SIZE = 20;

function pillDominio(d: string) {
  if (d === 'tic') return { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1E40AF', label: 'TIC' };
  if (d === 'comunicaciones') return { bg: '#F0FDF4', border: '#BBF7D0', fg: '#15803D', label: 'Comunic.' };
  if (d === 'infraestructura') return { bg: '#FEF3C7', border: '#FDE68A', fg: '#92400E', label: 'Infra.' };
  return { bg: '#F1F5F9', border: '#E2E8F0', fg: '#475569', label: 'General' };
}

export function AdminCategoriasScreen() {
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [dominio, setDominio] = useState<DominioCategoria | 'todos'>('todos');
  const [activa, setActiva] = useState<boolean | 'todos'>('todos');
  const [rows, setRows] = useState<TicketCategoria[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<TicketCategoria | null>(null);
  const [formDominio, setFormDominio] = useState<DominioCategoria>('tic');
  const [formSub, setFormSub] = useState('');
  const [formOrden, setFormOrden] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
      const res = await listCategoriasPaginated(supabase, {
        search: qDeb || undefined,
        dominio: dominio as never,
        activa: activa as never,
        page: targetPage + 1,
        pageSize: PAGE_SIZE,
      });
      setTotal(res.count);
      setHasMore(res.data.length === PAGE_SIZE);
      setPage(targetPage);
      setRows((prev) => (opts.reset || first ? res.data : [...prev, ...res.data]));
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
  }, [qDeb, dominio, activa]);

  useEffect(() => { fetchPage(0, { reset: true }); }, [fetchPage]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchPage(0, { reset: true }); }, [fetchPage]);
  const onEndReached = useCallback(() => { if (loadingMore || loading || !hasMore) return; fetchPage(page + 1); }, [loadingMore, loading, hasMore, page, fetchPage]);
  const hasFilters = !!qDeb || dominio !== 'todos' || activa !== 'todos';
  const clearFilters = () => { setQ(''); setDominio('todos'); setActiva('todos'); };

  const toggleActiva = async (r: TicketCategoria) => {
    try { const upd = await setCategoriaActiva(supabase, r.id, !r.activa); setRows((prev) => prev.map((x) => x.id === r.id ? upd : x)); }
    catch (e) { setErrorMsg(e instanceof Error ? e.message : String(e)); }
  };

  const submitCreate = async () => {
    const orden = formOrden.trim() ? Number(formOrden) : 0;
    const errs = validateCreateCategoria({ dominio: formDominio, subcategoria: formSub, orden });
    if (Object.keys(errs).length) { setFormError(Object.values(errs).join(' · ')); return; }
    setSaving(true); setFormError(null);
    try {
      const created = await createCategoria(supabase, { dominio: formDominio, subcategoria: formSub, orden });
      setCreateOpen(false); setFormSub(''); setFormOrden('0');
      setRows((prev) => [created, ...prev]); setTotal((n) => n + 1);
    } catch (e) { setFormError(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  };

  const openEdit = (r: TicketCategoria) => { setEditRow(r); setFormDominio(r.dominio as DominioCategoria); setFormSub(r.subcategoria); setFormOrden(String(r.orden)); setFormError(null); };
  const submitEdit = async () => {
    if (!editRow) return;
    const orden = formOrden.trim() ? Number(formOrden) : 0;
    const patch: Record<string, unknown> = {};
    if (formDominio !== editRow.dominio) patch.dominio = formDominio;
    if (formSub.trim() !== editRow.subcategoria) patch.subcategoria = formSub;
    if (orden !== editRow.orden) patch.orden = orden;
    if (!Object.keys(patch).length) { setEditRow(null); return; }
    const errs = validateUpdateCategoria(patch as never);
    if (Object.keys(errs).length) { setFormError(Object.values(errs).join(' · ')); return; }
    setSaving(true); setFormError(null);
    try {
      const upd = await updateCategoria(supabase, editRow.id, patch as never);
      setRows((prev) => prev.map((x) => x.id === upd.id ? upd : x));
      setEditRow(null);
    } catch (e) { setFormError(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  };

  const renderItem = ({ item }: { item: TicketCategoria }) => {
    const p = pillDominio(item.dominio);
    return (
      <Card style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.cardId}>#{item.id}</Text>
          <View style={[s.domPill, { backgroundColor: p.bg, borderColor: p.border }]}><Text style={[s.domText, { color: p.fg }]}>{p.label}</Text></View>
          <View style={[s.activaPill, item.activa ? s.activaOn : s.activaOff]}><Text style={[s.activaText, item.activa ? s.activaTextOn : s.activaTextOff]}>{item.activa ? 'Activa' : 'Inactiva'}</Text></View>
        </View>
        <Text style={s.name} numberOfLines={2}>{item.subcategoria}</Text>
        <Text style={s.meta}>Orden {item.orden} · {item.dominio}</Text>
        <View style={s.actions}>
          <Pressable onPress={() => openEdit(item)} style={s.btnGhost}><Text style={s.btnGhostText}>Editar</Text></Pressable>
          <Pressable onPress={() => toggleActiva(item)} style={[s.btnGhost, !item.activa && s.btnGhostAccent]}><Text style={[s.btnGhostText, !item.activa && { color: theme.colors.primary }]}>{item.activa ? 'Desactivar' : 'Activar'}</Text></Pressable>
        </View>
      </Card>
    );
  };

  if (loading && rows.length === 0) return <View style={s.center}><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando categorías…</Text>{errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}</View>;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={s.headerRow}><Text style={s.h1}>Categorías · {total}</Text>
          <Pressable onPress={() => { setCreateOpen(true); setFormError(null); }} style={s.btnPrimary}><Text style={s.btnPrimaryText}>+ Nueva categoría</Text></Pressable>
        </View>
        <Text style={s.subtitle}>Administra categorías maestras por dominio (tic, comunicaciones, infraestructura, general). Únicas por dominio.</Text>
        {errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}
        <View style={s.filters}>
          <View style={s.searchWrap}><Text style={s.searchIcon}>⌕</Text><TextInput value={q} onChangeText={setQ} placeholder="Buscar subcategoría…" placeholderTextColor={theme.colors.mutedSoft} style={s.searchInput} /></View>
          <View style={s.chipsRow}>
            {(['todos', ...DOMINIOS] as const).map((d) => (
              <Pressable key={d} onPress={() => setDominio(d as never)} style={[s.chip, dominio === d && s.chipActive]}><Text style={[s.chipText, dominio === d && s.chipTextActive]}>{d}</Text></Pressable>
            ))}
            <View style={{ width: 12 }} />
            {(['todos', true, false] as const).map((v) => (
              <Pressable key={String(v)} onPress={() => setActiva(v as never)} style={[s.chip, activa === v && s.chipActive]}><Text style={[s.chipText, activa === v && s.chipTextActive]}>{v === 'todos' ? 'Todas' : v ? 'Activas' : 'Inactivas'}</Text></Pressable>
            ))}
            {hasFilters ? <Pressable onPress={clearFilters} style={s.clearBtn}><Text style={s.clearText}>Limpiar</Text></Pressable> : null}
          </View>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(x) => String(x.id)}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : hasFilters && rows.length === 0 ? <View style={s.empty}><Text style={s.muted}>Sin resultados</Text></View> : null}
      />

      {/* Crear */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setCreateOpen(false)} />
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Nueva categoría</Text>
          <View style={s.chipsRow}>{DOMINIOS.map((d) => <Pressable key={d} onPress={() => setFormDominio(d)} style={[s.chip, formDominio === d && s.chipActive]}><Text style={[s.chipText, formDominio === d && s.chipTextActive]}>{d}</Text></Pressable>)}</View>
          <Text style={s.label}>Subcategoría *</Text><TextInput value={formSub} onChangeText={setFormSub} placeholder="Ej. Redes y conectividad" placeholderTextColor={theme.colors.mutedSoft} style={s.input} />
          <Text style={s.label}>Orden</Text><TextInput value={formOrden} onChangeText={(t) => setFormOrden(t.replace(/[^0-9-]/g, ''))} placeholder="0" keyboardType="number-pad" style={s.input} />
          {formError ? <Text style={s.error}>{formError}</Text> : null}
          <View style={s.modalActions}>
            <Pressable onPress={() => setCreateOpen(false)} style={[s.btnGhost, s.modalBtn]}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable onPress={submitCreate} disabled={saving} style={[s.btnPrimary, s.modalBtn, saving && { opacity: 0.6 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Crear</Text>}</Pressable>
          </View>
        </View>
      </Modal>

      {/* Editar */}
      <Modal visible={!!editRow} transparent animationType="fade" onRequestClose={() => setEditRow(null)}>
        <Pressable style={s.backdrop} onPress={() => setEditRow(null)} />
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Editar categoría #{editRow?.id}</Text>
          <View style={s.chipsRow}>{DOMINIOS.map((d) => <Pressable key={d} onPress={() => setFormDominio(d)} style={[s.chip, formDominio === d && s.chipActive]}><Text style={[s.chipText, formDominio === d && s.chipTextActive]}>{d}</Text></Pressable>)}</View>
          <Text style={s.label}>Subcategoría *</Text><TextInput value={formSub} onChangeText={setFormSub} style={s.input} />
          <Text style={s.label}>Orden</Text><TextInput value={formOrden} onChangeText={(t) => setFormOrden(t.replace(/[^0-9-]/g, ''))} keyboardType="number-pad" style={s.input} />
          {formError ? <Text style={s.error}>{formError}</Text> : null}
          <View style={s.modalActions}>
            <Pressable onPress={() => setEditRow(null)} style={[s.btnGhost, s.modalBtn]}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
            <Pressable onPress={submitEdit} disabled={saving} style={[s.btnPrimary, s.modalBtn, saving && { opacity: 0.6 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Guardar</Text>}</Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  muted: { color: theme.colors.muted, fontSize: 12 },
  error: { color: theme.colors.danger, fontSize: 11, backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 8, padding: 8 },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  subtitle: { fontSize: 11, color: theme.colors.muted, lineHeight: 15 },
  btnPrimary: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  filters: { gap: 8, marginTop: 4 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 10, height: 38, gap: 6 },
  searchIcon: { color: theme.colors.mutedSoft, fontSize: 13 },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, height: 28, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 11, color: theme.colors.textSoft, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  clearBtn: { paddingHorizontal: 10, height: 28, borderRadius: 999, backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  card: { flex: 1, maxWidth: '49%', padding: 12, borderRadius: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardId: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '700' },
  domPill: { paddingHorizontal: 7, height: 20, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  domText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  activaPill: { marginLeft: 'auto', paddingHorizontal: 7, height: 18, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  activaOn: { backgroundColor: '#E6F4FF', borderColor: '#B9D9FF' },
  activaOff: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  activaText: { fontSize: 9, fontWeight: '800' },
  activaTextOn: { color: theme.colors.primary },
  activaTextOff: { color: theme.colors.muted },
  name: { fontSize: 13, fontWeight: '800', color: theme.colors.text, lineHeight: 16 },
  meta: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  btnGhost: { flex: 1, height: 32, borderRadius: 9, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  btnGhostAccent: { borderColor: theme.colors.primary, backgroundColor: '#E6F4FF' },
  btnGhostText: { fontSize: 11, fontWeight: '700', color: theme.colors.textSoft },
  empty: { padding: 20, alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.45)' } as never,
  modalCard: { marginHorizontal: 16, marginTop: 90, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  label: { fontSize: 11, fontWeight: '700', color: theme.colors.textSoft },
  input: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, color: theme.colors.text },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
