// RF-27 — Admin: tabla de usuarios + edición con cambio de contraseña
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ROLES, type AdminUser, type CreateUserInput, type Mesa, listMesas, listUsers, setUserActivo, theme, updateUser, validateCreateUser, validatePasswordSync, validateUpdateUser } from '@helpdesk/shared';
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
  const [formEdit, setFormEdit] = useState<{ fullName: string; email: string; rol: string; mesaId: number | null; activo: boolean; cambiarPass: boolean; password: string; passwordConfirm: string }>({ fullName: '', email: '', rol: 'usuario', mesaId: null, activo: true, cambiarPass: false, password: '', passwordConfirm: '' });
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

  const toggleActivo = async (u: AdminUser) => {
    try {
      await setUserActivo(supabase, u.id, !u.activo);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x)));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setFormEdit({ fullName: u.fullName, email: u.email || '', rol: u.rol, mesaId: u.mesaId, activo: u.activo, cambiarPass: false, password: '', passwordConfirm: '' });
    setFormError(null);
  };

  const submitEdit = async () => {
    if (!editUser) return;
    // Validación base
    const patch: Record<string, unknown> = {};
    const errs: string[] = [];
    const baseErrs = validateUpdateUser({ fullName: formEdit.fullName, email: formEdit.email || undefined, rol: formEdit.rol as never, mesaId: formEdit.mesaId as never });
    if (Object.keys(baseErrs).length) errs.push(Object.values(baseErrs).join(' · '));
    if (formEdit.cambiarPass) {
      if (!formEdit.password || !formEdit.passwordConfirm) errs.push('Contraseña y confirmación requeridas');
      else if (formEdit.password !== formEdit.passwordConfirm) errs.push('Las contraseñas no coinciden');
      else {
        const v = validatePasswordSync(formEdit.password, { email: formEdit.email, nombre: formEdit.fullName, rol: formEdit.rol });
        if (!v.ok) errs.push(v.reasons.join(' · '));
      }
    }
    if (errs.length) { setFormError(errs.join(' · ')); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (formEdit.fullName.trim() !== editUser.fullName) payload.fullName = formEdit.fullName.trim();
      if ((formEdit.email || '').trim() !== (editUser.email || '')) payload.email = formEdit.email.trim();
      if (formEdit.rol !== editUser.rol) payload.rol = formEdit.rol as never;
      if (formEdit.mesaId !== editUser.mesaId) payload.mesaId = formEdit.mesaId;
      if (formEdit.activo !== editUser.activo) payload.activo = formEdit.activo;
      if (formEdit.cambiarPass) payload.password = formEdit.password;
      if (Object.keys(payload).length === 0) { setEditUser(null); setSaving(false); return; }
      await updateUser(supabase, editUser.id, payload as never);
      setUsers((prev) => prev.map((x) => (x.id === editUser.id ? { ...x, fullName: formEdit.fullName.trim(), email: formEdit.email.trim(), rol: formEdit.rol as never, mesaId: formEdit.mesaId, activo: formEdit.activo } : x)));
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
      const { createUser } = await import('@helpdesk/shared');
      await createUser(supabase, form);
      setCreateOpen(false);
      setForm({ fullName: '', email: '', password: '', rol: 'usuario', mesaId: null });
      fetchPage(0, { reset: true });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const renderRow = ({ item }: { item: AdminUser }) => {
    const pill = pillRol(item.rol);
    const initials = item.fullName.slice(0, 2).toUpperCase();
    return (
      <View style={s.tr}>
        <View style={s.tdUser}>
          <View style={s.avatarSm}><Text style={s.avatarSmText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.tdName} numberOfLines={1}>{item.fullName}</Text>
            <Text style={s.tdSub} numberOfLines={1}>{item.mesaNombre ?? (item.mesaId ? `Mesa #${item.mesaId}` : 'Sin dependencia')}</Text>
          </View>
        </View>
        <View style={s.tdEmail}><Text style={s.tdText} numberOfLines={1}>{item.email || '—'}</Text></View>
        <View style={s.tdRol}><View style={[s.rolPill, { backgroundColor: pill.bg, borderColor: pill.border }]}><Text style={[s.rolText, { color: pill.fg }]}>{pill.label}</Text></View></View>
        <View style={s.tdMesa}><Text style={s.tdText} numberOfLines={1}>{item.mesaNombre ?? '—'}</Text></View>
        <View style={s.tdEstado}><View style={[s.estadoPill, item.activo ? s.activoOn : s.activoOff]}><Text style={[s.estadoText, item.activo ? s.estadoTextOn : s.estadoTextOff]}>{item.activo ? 'Activo' : 'Inactivo'}</Text></View></View>
        <View style={s.tdActs}>
          <Pressable onPress={() => openEdit(item)} style={s.iconBtn} accessibilityRole="button" accessibilityLabel={`Editar ${item.fullName}`}><Text style={s.iconBtnText}>✎</Text></Pressable>
          <Pressable onPress={() => toggleActivo(item)} style={[s.iconBtn, item.activo ? s.iconBtnOff : s.iconBtnOn]} accessibilityRole="button" accessibilityLabel={item.activo ? 'Desactivar' : 'Activar'}><Text style={[s.iconBtnText, item.activo ? { color: '#991B1B' } : { color: '#15803D' }]}>{item.activo ? '◯' : '●'}</Text></Pressable>
        </View>
      </View>
    );
  };

  if (loading && users.length === 0) {
    return <View style={s.center}><ActivityIndicator color={theme.colors.primary} /><Text style={s.muted}>Cargando usuarios…</Text>{errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}</View>;
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.h1}>Usuarios · {total}</Text>
          <Pressable onPress={() => { setCreateOpen(true); setFormError(null); }} style={s.btnPrimary} accessibilityRole="button"><Text style={s.btnPrimaryText}>+ Nuevo usuario</Text></Pressable>
        </View>
        <Text style={s.subtitle}>Gestión centralizada. Usa la tabla para acciones rápidas.</Text>
        {errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}
      </View>

      {/* Filtros */}
      <View style={s.filterCard}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre…" placeholderTextColor={theme.colors.mutedSoft} style={s.search} returnKeyType="search" />
          {!!q && <Pressable onPress={() => setQ('')} style={s.clearBtn}><Text style={s.clearText}>×</Text></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsScroll}>
          <View style={s.chipsBlock}>
            <Text style={s.chipsLabel}>Rol</Text>
            <View style={s.chipsRow}>
              {(['todos', ...ROLES] as const).map((r) => (
                <Pressable key={String(r)} onPress={() => setRol(r as never)} style={[s.chip, rol === r && s.chipActive]}><Text style={[s.chipText, rol === r && s.chipTextActive]}>{r === 'todos' ? 'Todos' : r}</Text></Pressable>
              ))}
            </View>
          </View>
          <View style={s.chipsBlock}>
            <Text style={s.chipsLabel}>Dependencia</Text>
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
          {hasActiveFilters ? <Pressable onPress={clearFilters}><Text style={s.linkText}>Limpiar filtros</Text></Pressable> : null}
        </View>
      </View>

      {/* Tabla */}
      <View style={s.tableWrap}>
        <View style={s.thead}>
          <Text style={[s.th, s.thUser]}>Usuario</Text>
          <Text style={[s.th, s.thEmail]}>Correo</Text>
          <Text style={[s.th, s.thRol]}>Rol</Text>
          <Text style={[s.th, s.thMesa]}>Dependencia</Text>
          <Text style={[s.th, s.thEstado]}>Estado</Text>
          <Text style={[s.th, s.thActs]}>Acciones</Text>
        </View>
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderRow}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>Sin usuarios</Text><Text style={s.mutedCenter}>Ajusta filtros o crea el primer usuario.</Text></View>}
          ListFooterComponent={loadingMore ? <View style={{ padding: 12, alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} /></View> : null}
          contentContainerStyle={s.tableContent}
        />
      </View>

      {/* Modal Crear */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nuevo usuario</Text>
            <Text style={s.modalHint}>Requiere rol administrador. La contraseña debe cumplir política segura (8–64, no común, no datos personales).</Text>
            <TextInput value={form.fullName} onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))} placeholder="Nombre completo *" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />
            <TextInput value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="Correo corporativo *" style={s.input} placeholderTextColor={theme.colors.mutedSoft} autoCapitalize="none" keyboardType="email-address" />
            <TextInput value={form.password} onChangeText={(v) => setForm((p) => ({ ...p, password: v }))} placeholder="Contraseña *" style={s.input} placeholderTextColor={theme.colors.mutedSoft} secureTextEntry />
            <View style={s.rowGap}>
              {ROLES.map((r) => (
                <Pressable key={r} onPress={() => setForm((p) => ({ ...p, rol: r }))} style={[s.chip, form.rol === r && s.chipActive]}><Text style={[s.chipText, form.rol === r && s.chipTextActive]}>{r}</Text></Pressable>
              ))}
            </View>
            <View style={s.rowGap}>
              <Pressable onPress={() => setForm((p) => ({ ...p, mesaId: null }))} style={[s.chip, form.mesaId === null && s.chipActive]}><Text style={[s.chipText, form.mesaId === null && s.chipTextActive]}>Sin dependencia</Text></Pressable>
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

      {/* Modal Editar — nueva interfaz solicitada */}
      <Modal visible={!!editUser} transparent animationType="fade" onRequestClose={() => setEditUser(null)}>
        <View style={s.modalBackdrop}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }} keyboardShouldPersistTaps="handled">
            <View style={s.modalCardLarge}>
              <Text style={s.modalTitle}>Editar · {editUser?.fullName}</Text>
              <Text style={s.modalHint}>Modifica los datos del perfil. Los cambios requieren rol administrador.</Text>

              <Text style={s.fieldLabel}>Nombre completo *</Text>
              <TextInput value={formEdit.fullName} onChangeText={(v) => setFormEdit((p) => ({ ...p, fullName: v }))} placeholder="Nombre completo" style={s.input} placeholderTextColor={theme.colors.mutedSoft} />

              <Text style={s.fieldLabel}>Correo electrónico *</Text>
              <TextInput value={formEdit.email} onChangeText={(v) => setFormEdit((p) => ({ ...p, email: v }))} placeholder="correo@empresa.com" style={s.input} placeholderTextColor={theme.colors.mutedSoft} autoCapitalize="none" keyboardType="email-address" />

              <Text style={s.fieldLabel}>Rol *</Text>
              <View style={s.rowGap}>
                {ROLES.map((r) => (
                  <Pressable key={r} onPress={() => setFormEdit((p) => ({ ...p, rol: r }))} style={[s.chip, formEdit.rol === r && s.chipActive]}><Text style={[s.chipText, formEdit.rol === r && s.chipTextActive]}>{r}</Text></Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>Dependencia</Text>
              <View style={s.rowGap}>
                <Pressable onPress={() => setFormEdit((p) => ({ ...p, mesaId: null }))} style={[s.chip, formEdit.mesaId === null && s.chipActive]}><Text style={[s.chipText, formEdit.mesaId === null && s.chipTextActive]}>Sin dependencia</Text></Pressable>
                {mesas.map((m) => (
                  <Pressable key={m.id} onPress={() => setFormEdit((p) => ({ ...p, mesaId: m.id }))} style={[s.chip, formEdit.mesaId === m.id && s.chipActive]}><Text style={[s.chipText, formEdit.mesaId === m.id && s.chipTextActive]}>{m.nombre}</Text></Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>Estado</Text>
              <Pressable onPress={() => setFormEdit((p) => ({ ...p, activo: !p.activo }))} style={[s.toggleRow, formEdit.activo && s.toggleRowOn]}>
                <View style={[s.toggleDot, formEdit.activo && s.toggleDotOn]} />
                <Text style={[s.toggleLabel, formEdit.activo && s.toggleLabelOn]}>{formEdit.activo ? 'Activo' : 'Inactivo'}</Text>
              </Pressable>

              {/* Cambiar contraseña */}
              <View style={s.divider} />
              <Pressable onPress={() => setFormEdit((p) => ({ ...p, cambiarPass: !p.cambiarPass }))} style={s.checkRow}>
                <View style={[s.checkBox, formEdit.cambiarPass && s.checkBoxOn]}>{formEdit.cambiarPass ? <Text style={s.checkTick}>✓</Text> : null}</View>
                <Text style={s.checkLabel}>Cambiar contraseña</Text>
              </Pressable>
              {formEdit.cambiarPass ? (
                <View style={{ gap: 10, marginTop: 8 }}>
                  <TextInput value={formEdit.password} onChangeText={(v) => setFormEdit((p) => ({ ...p, password: v }))} placeholder="Nueva contraseña" style={s.input} placeholderTextColor={theme.colors.mutedSoft} secureTextEntry />
                  <TextInput value={formEdit.passwordConfirm} onChangeText={(v) => setFormEdit((p) => ({ ...p, passwordConfirm: v }))} placeholder="Repetir contraseña" style={s.input} placeholderTextColor={theme.colors.mutedSoft} secureTextEntry />
                  <Text style={s.helpText}>Mín. 8–64, sin datos personales, evita secuencias/common. Se valida en cliente con NIST/OWASP.</Text>
                  {formEdit.password.length > 0 ? (() => { const v = validatePasswordSync(formEdit.password, { email: formEdit.email, nombre: formEdit.fullName, rol: formEdit.rol }); return <Text style={[s.helpText, v.ok ? { color: '#15803D' } : { color: theme.colors.danger }]}>{v.ok ? '✓ Contraseña válida' : v.reasons.join(' · ')}</Text>; })() : null}
                  {formEdit.password && formEdit.passwordConfirm && formEdit.password !== formEdit.passwordConfirm ? <Text style={[s.helpText, { color: theme.colors.danger }]}>Las contraseñas no coinciden</Text> : null}
                </View>
              ) : null}

              {formError ? <Text style={s.error}>{formError}</Text> : null}
              <View style={s.modalActions}>
                <Pressable onPress={() => setEditUser(null)} style={s.btnGhost}><Text style={s.btnGhostText}>Cancelar</Text></Pressable>
                <Pressable onPress={submitEdit} style={[s.btnPrimary, saving && { opacity: 0.6 }]} disabled={saving}><Text style={s.btnPrimaryText}>{saving ? 'Guardando…' : 'Guardar cambios'}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
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
  header: { paddingHorizontal: theme.space[4], paddingTop: theme.space[4], paddingBottom: theme.space[2], gap: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space[3] },
  h1: { fontSize: 20, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3, flex: 1 },
  subtitle: { fontSize: 11, color: theme.colors.muted, lineHeight: 14 },
  btnPrimary: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, height: 36, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  filterCard: {
    marginHorizontal: theme.space[3], marginBottom: theme.space[3], gap: theme.space[2],
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.space[3],
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space[3], height: 40,
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
    paddingHorizontal: 12, paddingVertical: 5, height: 28, justifyContent: 'center',
    borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  chipTextActive: { color: theme.colors.primaryDark, fontWeight: '700' },
  filterFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  filterCount: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  linkText: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  // Tabla
  tableWrap: { flex: 1, marginHorizontal: theme.space[3], marginBottom: theme.space[3], backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden', ...theme.shadow.soft },
  thead: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: 12, height: 36, gap: 8 },
  th: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.colors.muted },
  thUser: { flex: 2.2 },
  thEmail: { flex: 1.8 },
  thRol: { width: 92, textAlign: 'center' },
  thMesa: { flex: 1.2 },
  thEstado: { width: 88, textAlign: 'center' },
  thActs: { width: 80, textAlign: 'center' },
  tableContent: { paddingBottom: 8 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 8, minHeight: 52 },
  tdUser: { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSm: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarSmText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  tdName: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  tdSub: { fontSize: 10, color: theme.colors.muted },
  tdEmail: { flex: 1.8 },
  tdRol: { width: 92, alignItems: 'center' },
  tdMesa: { flex: 1.2 },
  tdEstado: { width: 88, alignItems: 'center' },
  tdActs: { width: 80, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  tdText: { fontSize: 11, color: theme.colors.text },
  rolPill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  rolText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  estadoPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  activoOn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  activoOff: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  estadoText: { fontSize: 10, fontWeight: '700' },
  estadoTextOn: { color: '#15803D' },
  estadoTextOff: { color: '#991B1B' },
  iconBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  iconBtnOn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  iconBtnOff: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  iconBtnText: { fontSize: 12, fontWeight: '800', color: theme.colors.text },
  empty: { alignItems: 'center', padding: 24, gap: 8, marginTop: 12 },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  // Modales
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.space[4], gap: 12, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft },
  modalCardLarge: { width: '100%', maxWidth: 560, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.space[4], gap: 10, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.soft },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  modalHint: { fontSize: 11, color: theme.colors.muted, lineHeight: 14 },
  input: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, paddingHorizontal: 12, height: 42, fontSize: 13, color: theme.colors.text },
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  btnGhost: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.text, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.full, paddingHorizontal: 12, height: 32, alignSelf: 'flex-start' },
  toggleRowOn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  toggleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.mutedSoft },
  toggleDotOn: { backgroundColor: '#15803D' },
  toggleLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },
  toggleLabelOn: { color: '#15803D' },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkTick: { color: '#fff', fontSize: 11, fontWeight: '800' },
  checkLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  helpText: { fontSize: 10, color: theme.colors.muted, lineHeight: 13 },
});
