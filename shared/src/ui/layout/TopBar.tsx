// TopBar — Stitch h-16: brand + search ⌘K + nav En Vivo/Mesas/SLA/Técnicos/IA Intel
import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme.js';
import { Clock } from '../Clock.js';

export function TopBar({
  searchValue,
  onSearchChange,
  right,
}: {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.wrap}>
      <View style={s.left}>
        <Text style={s.brand}>HelpDesk</Text>
        <Text style={s.badge}>V4.8-PROD</Text>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder="Buscar ticket, mesa, categoría…"
            placeholderTextColor={theme.colors.mutedSoft}
            style={s.search}
            accessibilityLabel="Buscar global"
          />
          <Text style={s.kbd}>⌘K</Text>
        </View>
      </View>
      <View style={s.center}>
        {['En Vivo', 'Mesas', 'SLA', 'Técnicos', 'IA Intel'].map((l) => (
          <Text key={l} style={s.navItem}>
            {l}
          </Text>
        ))}
      </View>
      <View style={s.right}>{right}<Clock /></View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[6], // 24 — token space-6
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.space[3], // 12
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], flex: 1 }, // 12 — box model
  brand: { fontSize: 14, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  badge: { fontSize: 10, fontWeight: '700', color: theme.colors.primary, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 6, paddingVertical: 3, borderRadius: theme.radius.full, overflow: 'hidden' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm, // 10 — token sm (antes 12)
    paddingHorizontal: theme.space[3] - 2, // 10
    gap: theme.space[2], // 8
    height: 44, // 44 — alinea con Button 44 (antes 36)
    width: 260, // 260 — +20 para legibilidad
    marginLeft: theme.space[2], // 8
  },
  searchIcon: { color: theme.colors.mutedSoft, fontSize: 12 },
  search: { flex: 1, fontSize: 12, color: theme.colors.text, paddingVertical: 0 },
  kbd: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '700', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: theme.colors.surface },
  center: { flexDirection: 'row', gap: theme.space[4], alignItems: 'center' }, // 16
  navItem: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }, // 8

});
