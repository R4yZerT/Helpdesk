// Sidebar — Stitch nav vertical w-64
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';

export type SidebarItem = { id: string; label: string; active?: boolean; onPress?: () => void; icon?: React.ReactNode };

export function Sidebar({ items, footer, user, onLogout }: { items: SidebarItem[]; footer?: React.ReactNode; user?: { name: string; role: string }; onLogout: () => void }) {
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={s.logoDot} />
        <View>
          <Text style={s.logoTitle}>HelpDesk</Text>
          <Text style={s.logoSub}>Mesa de Ayuda</Text>
        </View>
      </View>
      <View style={s.nav}>
        {items.map((it) => (
          <Pressable key={it.id} onPress={it.onPress} style={[s.item, it.active && s.itemActive]}>
            <View style={s.itemRow}>
              {it.icon ? <View style={s.itemIcon}>{it.icon}</View> : null}
              <Text style={[s.itemText, it.active && s.itemTextActive]}>{it.label}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      {user ? (
        <View style={s.userCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={s.userName}>{user.name}</Text>
            <Text style={s.userRole}>{user.role}</Text>
          </View>
        </View>
      ) : null}
      {footer}
      {/* Global: cerrar sesión siempre visible abajo — no opcional (estándar AppShell) */}
      <Pressable onPress={onLogout} style={s.logoutBtn} accessibilityRole="button" accessibilityLabel="Cerrar sesión">
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, gap: theme.space[4] }, // 16 — token space-4
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3], // 12 — token space-3
    paddingBottom: theme.space[3], // 12 — box model estándar
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  logoDot: { width: 32, height: 32, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primary },
  logoTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  logoSub: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  nav: { gap: theme.space[1] }, // 4 — token space-1
  item: { paddingHorizontal: theme.space[3], paddingVertical: theme.space[3] - 2, borderRadius: theme.radius.sm }, // 12/10/10 — tokens
  itemActive: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: '#BFDBFE' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemIcon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  itemTextActive: { color: theme.colors.primaryDark },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.md, // 14 — token md
    padding: theme.space[3] - 2, // 10 — compensa icono 32
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 'auto',
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  userName: { fontSize: 11, fontWeight: '700', color: theme.colors.text },
  userRole: { fontSize: 10, color: theme.colors.muted },
  logoutBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  logoutText: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },

});
