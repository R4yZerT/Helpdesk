// TopBar — Stitch h-16: brand + search ⌘K + nav En Vivo/Mesas/SLA/Técnicos/IA Intel
import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme.js';

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
      <View style={s.right}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brand: { fontSize: 14, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  badge: { fontSize: 10, fontWeight: '700', color: theme.colors.primary, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 10, gap: 6, height: 36, width: 240, marginLeft: 8 },
  searchIcon: { color: theme.colors.mutedSoft, fontSize: 12 },
  search: { flex: 1, fontSize: 12, color: theme.colors.text, paddingVertical: 0 },
  kbd: { fontSize: 10, color: theme.colors.mutedSoft, fontWeight: '700', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: theme.colors.surface },
  center: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  navItem: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
