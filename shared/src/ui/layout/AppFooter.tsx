// AppFooter — global legal footer (Stitch)
import * as React from 'react';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { theme } from '../theme.js';

export function AppFooter() {
  const { width } = useWindowDimensions();
  const compact = width < 768;
  return (
    <View style={s.wrap}>
      <View style={compact ? s.innerCol : s.innerRow}>
        <Text style={s.copy}>© 2026 Institución Universitaria de Envigado · Mesa de Ayuda HelpDesk</Text>
        <View style={s.links}>
          <Pressable onPress={() => Linking.openURL('#privacidad')}><Text style={s.link}>Privacidad</Text></Pressable>
          <Text style={s.dot}>·</Text>
          <Pressable onPress={() => Linking.openURL('#terminos')}><Text style={s.link}>Términos</Text></Pressable>
          <Text style={s.dot}>·</Text>
          <Pressable onPress={() => Linking.openURL('#soporte')}><Text style={s.link}>Soporte</Text></Pressable>
          <Text style={s.dot}>·</Text>
          <Text style={s.version}>v4.8-prod · SLA 96.4%</Text>
        </View>
      </View>
      <Text style={s.sub}>Hecho para operación L2 · #0E87E2 / #FD7C06 · Inter / JetBrains Mono</Text>
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
  innerCol: { flexDirection: 'column', gap: theme.space[2] },
  copy: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  links: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  link: { fontSize: 11, color: theme.colors.primaryDark, fontWeight: '700' },
  dot: { fontSize: 11, color: theme.colors.mutedSoft },
  version: { fontSize: 11, color: theme.colors.mutedSoft, fontFamily: theme.font.mono, fontWeight: '500' },
  sub: { fontSize: 10, color: theme.colors.mutedSoft, fontFamily: theme.font.mono },
});
