// RF-27 — Admin: crear, editar y desactivar usuarios (rol+mesa)
// Stitch tokens: #0E87E2 / #FD7C06 / bg #F6F8FB / surface #FFF / border #E2E8F0
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ROLES, type AdminUser, type CreateUserInput, type Mesa, listMesas, listUsers, setUserActivo, updateUser, validateCreateUser, validateUpdateUser } from '@helpdesk/shared';
import { Card, theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

const PAGE_SIZE = 20;

function pillRol(rol: string) {
  if (rol === 'administrador') return { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1D4ED8', label: 'Admin' };
  if (rol === 'jefe') return { bg: '#F0FDF4', border: '#BBF7D0', fg: '#15803D', label: 'Jefe' };
  if (rol === 'tecnico') return { bg: '#FFF7ED', border: '#FED7AA', fg: '#C2410C', label: 'Técnico' };
  return { bg: '#F1F5F9', border: '#E2E8F0', fg: '#475569', label: 'Usuario' };
}

export function AdminUsuariosScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [rol, setRol] = useState<(typeof ROLES)[number] | 'todos'>('todos');
  const [mesaId, setMesaId] = useState<number | 'todos'>('todos');
  const [activo, setActivo] = useState<boolean | 'todos'>('todos');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modales
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<CreateUserInput>({ fullName: '', email: '', password: '', rol: 'usuario', mesaId: null });
  const [formEdit, setFormEdit] = useState<{ fullName: string; rol: string; mesaId: number | null; activo: boolean }>({ fullName: '', rol: 'usuario', mesaId: null, activo: true });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setQDebounced(q.trim()), 320);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [q]);

  useEffect(() => {
    listMesas(supabase).then(setMesas).catch(() => {});
  }, []);

  const fetchPage = useCallback(async (targetPage: number, opts: { reset?: boolean } = {}) => {
    const first = targetPage === 0;
    if (first) setLoading(true); else setLoadingMore(true);
    setErrorMsg(null);
    try {
      const res = await listUsers(supabase, {
        search: qDebounced || undefined,
        rol: rol as never,
        mesaId: mesaId as never,
        activo: activo as never,
        page: targetPage + 1,
        pageSize: PAGE_SIZE,
      });
      setTotal(res.count);
      setHasMore(res.data.length === PAGE_SIZE);
      setPage(targetPage);
      setUsers((prev) => (opts.reset || first ? res.data : [...prev, ...res.data]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      console.warn('[AdminUsuarios] listUsers', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [qDebounced, rol, mesaId, activo]);

  useEffect(() => { fetchPage(0, { reset: true }); }, [fetchPage]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchPage(0, { reset: true }); }, [fetchPage]);
  const onEndReached = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchPage(page + 1);
  }, [loadingMore, loading, hasMore, page, fetchPage]);

  const hasActiveFilters = !!qDebounced || rol !== 'todos' || mesaId !== 'todos' || activo !== 'todos';
  const clearFilters = () => { setQ(''); setRol('todos'); setMesaId('todos'); setActivo('todos'); };

  // Desactivar / activar
  const toggleActivo = async (u: AdminUser) => {
    try {
      await setUserActivo(supabase, u.id, !u.activo);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x)));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  // Abrir edición
  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setFormEdit({ fullName: u.fullName, rol: u.rol, mesaId: u.mesaId, activo: u.activo });
    setFormError(null);
  };

  const submitEdit = async () => {
    if (!editUser) return;
    const errs = validateUpdateUser({ fullName: formEdit.fullName, rol: formEdit.rol as never, mesaId: formEdit.mesaId as never });
    if (Object.keys(errs).length) { setFormError(Object.values(errs).join(' · ')); return; }
    setSaving(true);
    setFormError(null);
    try {
      await updateUser(supabase, editUser.id, { fullName: formEdit.fullName.trim(), rol: formEdit.rol as never, mesaId: formEdit.mesaId, activo: formEdit.activo });
      setUsers((prev) => prev.map((x) => (x.id === editUser.id ? { ...x, fullName: formEdit.fullName.trim(), rol: formEdit.rol as never, mesaId: formEdit.mesaId, activo: formEdit.activo } : x)));
      setEditUser(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const submitCreate = async () => {
    const errs = validateCreateUser(form);
    if (Object.keys(errs).length) { setFormError(Object.values(errs).join(' · ')); return; }
    setSaving(true);
    setFormError(null);
    try {
      // RF-27 requiere service_role; este call fallará con anon key y mostrará hint para Edge Function
      const { createUser } = await import('@helpdesk/shared');
      await createUser(supabase, form);
      setCreateOpen(false);
      setForm({ fullName: '', email: '', password: '', rol: 'usuario', mesaId: null });
      fetchPage(0, { reset: true });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const renderItem = ({ item }: { item: AdminUser }) => {
    const pill = pillRol(item.rol);
    return (
      <Card style={s.card}>
        <View style={s.cardTop}>
          <View style={[s.rolPill, { backgroundColor: pill.bg, borderColor: pill.border }]}><Text style={[s.rolText, { color: pill.fg }]}>{pill.label}</Text></View>
          <View style={[s.activoPill, item.activo ? s.activoOn : s.activoOff]}><Text style={[s.activoText, item.activo ? s.activoTextOn : s.activoTextOff]}>{item.activo ? 'Activo' : 'Inactivo'}</Text></View>
        </View>
        <Text style={s.name} numberOfLines={1}>{item.fullName}</Text>
        <Text style={s.meta} numberOfLines={1}>{item.mesaNombre ?? (item.mesaId ? `Mesa #${item.mesaId}` : 'Sin mesa')} · {new Date(item.creadoEn).toLocaleDateString('es-ES')}</Text>
        <View style={s.actions}>
          <Pressable onPress={() => openEdit(item)} style={s.btnGhost} accessibilityRole="button"><Text style={s.btnGhostText}>Editar</Text></Pressable>
          <Pressable onPress={() => toggleActivo(item)} style={[s.btnGhost, !item.activo && s.btnGhostAccent]} accessibilityRole="button"><Text style={[s.btnGhostText, !item.activo && { color: theme.colors.primary }]}>{item.activo ? 'Desactivar' : 'Activar'}</Text></Pressable>
        </View>
      </Card>
    );
  };

  if (loading && users.length === 0) {
    return <View style={s.center}><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando usuarios…</Text>{errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}</View>;
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={s.kickerRow}><View style={s.kickerDot} /><Text style={s.kicker}>Administrador · RF-27 / RF-28</Text></View>
        <View style={s.headerRow}>
          <Text style={s.h1}>Usuarios · {total}</Text>
          <Pressable onPress={() => { setCreateOpen(true); setFormError(null); }} style={s.btnPrimary} accessibilityRole="button" accessibilityLabel="Crear usuario"><Text style={s.btnPrimaryText}>+ Nuevo usuario</Text></Pressable>
        </View>
        <Text style={s.subtitle}>Crear, editar y desactivar usuarios. Asigna rol y mesa. Requiere rol administrador (RLS).</Text>
        {errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}
      </View>

      {/* Filtros */}
      <View style={s.filterCard}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre…" placeholderTextColor={theme.colors.mutedSoft} style={s.search} returnKeyType="search" accessibilityLabel="Buscar usuarios" />
          {!!q && <Pressable onPress={() => setQ('')} style={s.clearBtn}><Text style={s.clearText}>×</Text></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsScroll}>
          <View style={s.chipsBlock}>
            <Text style={s.chipsLabel}>Rol</Text>
            <View style={s.chipsRow}>
              {(['todos', ...ROLES] as const).map((r) => (
                <Pressable key={String(r)} onPress={() => setRol(r as never)} style={[s.chip, rol === r && s.chipActive]} accessibilityState={{ selected: rol === r }}><Text style={[s.chipText, rol === r && s.chipTextActive]}>{r === 'todos' ? 'Todos' : r}</Text></Pressable>
              ))}
            </View>
          </View>
          <View style={s.chipsBlock}>
            <Text style={s.chipsLabel}>Mesa</Text>
            <View style={s.chipsRow}>
              <Pressable onPress={() => setMesaId('todos')} style={[s.chip, mesaId === 'todos' && s.chipActive]}><Text style={[s.chipText, mesaId === 'todos' && s.chipTextActive]}>Todas</Text></Pressable>
              {mesas.map((m) => (
                <Pressable key={m.id} onPress={() => setMesaId(m.id)} style={[s.chip, mesaId === m.id && s.chipActive]}><Text style={[s.chipText, mesaId === m.id && s.chipTextActive]}>{m.nombre}</Text></Pressable>
              ))}
            </View>
          </View>
          <View style={s.chipsBlock}>
            <Text style={s.chipsLabel}>Estado</Text>
            <View style={s.chipsRow}>
              {(['todos', true, false] as const).map((v) => (
                <Pressable key={String(v)} onPress={() => setActivo(v as never)} style={[s.chip, activo === v && s.chipActive]}><Text style={[s.chipText, activo === v && s.chipTextActive]}>{v === 'todos' ? 'Todos' : v ? 'Activos' : 'Inactivos'}</Text></Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={s.filterFooter}>
          <Text style={s.filterCount}>{total} resultados{hasActiveFilters ? ' · filtrado' : ''}</Text>
          {hasActiveFilters ? <Pressable onPress={clearFilters} style={s.linkBtn}><Text style={s.linkText}>Limpiar filtros</Text></Pressable> : null}
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={renderItem}
        numColumns={isWide ? 2 : 1}
        key={isWide ? 'grid-2' : 'list-1'}
        columnWrapperStyle={isWide ? { gap: 12 } : undefined}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>Sin usuarios</Text><Text style={s.mutedCenter}>Ajusta filtros o crea el primer usuario.</Text></View>}
        ListFooterComponent={loadingMore ? <View style={{ padding: 16, alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} /></View> : null}
        contentContainerStyle={s.listContent}
      />

      {/* Modal Crear */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nuevo usuario · RF-27</Text>
            <Text style={s.modalHint}>Requiere service_role (Edge Function). Con anon key verás el hint de despliegue.</Text>
            <TextInput value={form.fullName} onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))} placeholder="Nombre completo *" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />
            <TextInput value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="Email corporativo *" style={s.input} placeholderTextColor={theme.colors.mutedSoft} autoCapitalize="none" keyboardType="email-address" />
            <TextInput value={form.password} onChangeText={(v) => setForm((p) => ({ ...p, password: v }))} placeholder="Contraseña (mín 8) *" style={s.input} placeholderTextColor={theme.colors.mutedSoft} secureTextEntry />
            <View style={s.rowGap}>
              {ROLES.map((r) => (
                <Pressable key={r} onPress={() => setForm((p) => ({ ...p, rol: r }))} style={[s.chip, form.rol === r && s.chipActive]}><Text style={[s.chipText, form.rol === r && s.chipTextActive]}>{r}</Text></Pressable>
              ))}
            </View>
            <View style={s.rowGap}>
              <Pressable onPress={() => setForm((p) => ({ ...p, mesaId: null }))} style={[s.chip, form.mesaId === null && s.chipActive]}><Text style={[s.chipText, form.mesaId === null && s.chipTextActive]}>Sin mesa</Text></Pressable>
              {mesas.map((m) => (
                <Pressable key={m.id} onPress={() => setForm((p) => ({ ...p, mesaId: m.id }))} style={[s.chip, form.mesaId === m.id && s.chipActive]}><Text style={[s.chipText, form.mesaId === m.id && s.chipTextActive]}>{m.nombre}</Text></Pressable>
              ))}
            </View>
            {formError ? <Text style={s.error}>{formError}</Text> : null}
            <View style={s.modalActions}>
              <Pressable onPress={() => setCreateOpen(false)} style={s.btnGhost}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
              <Pressable onPress={submitCreate} style={[s.btnPrimary, saving && { opacity: 0.6 }]} disabled={saving}><Text style={s.btnPrimaryText}>{saving ? 'Guardando…' : 'Crear'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Editar */}
      <Modal visible={!!editUser} transparent animationType="fade" onRequestClose={() => setEditUser(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Editar · {editUser?.fullName}</Text>
            <TextInput value={formEdit.fullName} onChangeText={(v) => setFormEdit((p) => ({ ...p, fullName: v }))} placeholder="Nombre completo" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />
            <View style={s.rowGap}>
              {ROLES.map((r) => (
                <Pressable key={r} onPress={() => setFormEdit((p) => ({ ...p, rol: r }))} style={[s.chip, formEdit.rol === r && s.chipActive]}><Text style={[s.chipText, formEdit.rol === r && s.chipTextActive]}>{r}</Text></Pressable>
              ))}
            </View>
            <View style={s.rowGap}>
              <Pressable onPress={() => setFormEdit((p) => ({ ...p, mesaId: null }))} style={[s.chip, formEdit.mesaId === null && s.chipActive]}><Text style={[s.chipText, formEdit.mesaId === null && s.chipTextActive]}>Sin mesa</Text></Pressable>
              {mesas.map((m) => (
                <Pressable key={m.id} onPress={() => setFormEdit((p) => ({ ...p, mesaId: m.id }))} style={[s.chip, formEdit.mesaId === m.id && s.chipActive]}><Text style={[s.chipText, formEdit.mesaId === m.id && s.chipTextActive]}>{m.nombre}</Text></Pressable>
              ))}
            </View>
            <Pressable onPress={() => setFormEdit((p) => ({ ...p, activo: !p.activo }))} style={[s.chip, formEdit.activo ? s.chipActive : undefined]}><Text style={[s.chipText, formEdit.activo && s.chipTextActive]}>{formEdit.activo ? 'Activo' : 'Inactivo'}</Text></Pressable>
            {formError ? <Text style={s.error}>{formError}</Text> : null}
            <View style={s.modalActions}>
              <Pressable onPress={() => setEditUser(null)} style={s.btnGhost}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
              <Pressable onPress={submitEdit} style={[s.btnPrimary, saving && { opacity: 0.6 }]} disabled={saving}><Text style={s.btnPrimaryText}>{saving ? 'Guardando…' : 'Guardar'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  filterCard: {
    marginHorizontal: theme.space[3], marginBottom: theme.space[3], gap: theme.space[3],
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.space[4],
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space[3], height: 44,
  },
  searchIcon: { color: theme.colors.mutedSoft, marginRight: 8, fontSize: 14 },
  search: { flex: 1, fontSize: 13, color: theme.colors.text, paddingVertical: 0 },
  clearBtn: { padding: 6, marginLeft: 6 },
  clearText: { fontSize: 18, color: theme.colors.muted, fontWeight: '600' },
  chipsScroll: { gap: 12 },
  chipsBlock: { gap: 6, marginRight: 12 },
  chipsLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.mutedSoft },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, height: 32, justifyContent: 'center',
    borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border,
  },
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
  rolPill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  rolText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  activoPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  activoOn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  activoOff: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  activoText: { fontSize: 10, fontWeight: '700' },
  activoTextOn: { color: '#15803D' },
  activoTextOff: { color: '#991B1B' },
  name: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  meta: { fontSize: 11, color: theme.colors.muted },
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
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
});
