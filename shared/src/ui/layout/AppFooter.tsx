// AppFooter — pie global institucional (sin enlaces ni métricas inventadas)
import * as React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { theme } from '../theme.js';

export function AppFooter() {
  const { width } = useWindowDimensions();
  const compact = width < 768;
  return (
    <View style={s.wrap}>
      <View style={compact ? s.innerCol : s.innerRow}>
        <Text style={s.copy}>© 2026 Institución Universitaria de Envigado · Mesa de Ayuda HelpDesk</Text>
        <Text style={s.sub}>Hecho para operación L2 · #0E87E2 / #FD7C06 · Inter / JetBrains Mono</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.space[6],
    paddingVertical: theme.space[3],
    gap: 4,
  },
  innerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.space[3] },
  innerCol: { flexDirection: 'column', gap: theme.space[1] },
  copy: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  sub: { fontSize: 10, color: theme.colors.mutedSoft, fontFamily: theme.font.mono },
});
