// Sidebar — Stitch nav vertical w-64
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';

export type SidebarItem = { id: string; label: string; active?: boolean; onPress?: () => void };

export function Sidebar({ items, footer, user }: { items: SidebarItem[]; footer?: React.ReactNode; user?: { name: string; role: string } }) {
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
            <Text style={[s.itemText, it.active && s.itemTextActive]}>{it.label}</Text>
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
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  logoDot: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.primary },
  logoTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  logoSub: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  nav: { gap: 4 },
  item: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  itemActive: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: '#BFDBFE' },
  itemText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  itemTextActive: { color: theme.colors.primaryDark },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.colors.border, marginTop: 'auto' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  userName: { fontSize: 11, fontWeight: '700', color: theme.colors.text },
  userRole: { fontSize: 10, color: theme.colors.muted },
});
