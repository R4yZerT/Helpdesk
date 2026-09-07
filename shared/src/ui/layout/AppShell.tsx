// AppShell — Stitch layout: aside w-64 fixed + ml-64 + TopBar h-16 + max-w 1280
import * as React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, Pressable, Text } from 'react-native';
import { theme } from '../theme.js';

const SIDEBAR_W = 256;
const MAX_W = 1280;
const BREAKPOINT = 1024;

export function AppShell({
  sidebar,
  topBar,
  filterBar,
  children,
}: {
  sidebar: React.ReactNode;
  topBar?: React.ReactNode;
  filterBar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT;
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Desktop: fixed sidebar + offset
  if (isDesktop) {
    return (
      <View style={s.root}>
        <View style={s.sidebarDesktop}>{sidebar}</View>
        <View style={s.mainDesktop}>
          {topBar}
          {filterBar}
          <ScrollView contentContainerStyle={s.canvas} showsVerticalScrollIndicator={false}>
            <View style={s.inner}>{children}</View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Mobile/Tablet: drawer overlay
  return (
    <View style={s.root}>
      {topBar ? (
        <View style={s.mobileTopBarWrap}>
          <Pressable onPress={() => setDrawerOpen((v) => !v)} style={s.burger} accessibilityRole="button" accessibilityLabel="Abrir menú">
            <Text style={s.burgerText}>☰</Text>
          </Pressable>
          <View style={{ flex: 1 }}>{topBar}</View>
        </View>
      ) : null}
      {filterBar}
      {drawerOpen ? (
        <Pressable style={s.overlay} onPress={() => setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar menú">
          <View style={s.drawer}>{sidebar}</View>
        </Pressable>
      ) : null}
      <ScrollView contentContainerStyle={[s.canvas, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
        <View style={s.inner}>{children}</View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg, flexDirection: 'row' },
  sidebarDesktop: {
    width: SIDEBAR_W,
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    padding: 16,
  },
  mainDesktop: { flex: 1, minWidth: 0 },
  canvas: { paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MAX_W, gap: 16 },
  mobileTopBarWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: 8, height: 56 },
  burger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  burgerText: { fontSize: 18, color: theme.colors.text },
  overlay: { position: 'absolute', top: 56, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 50, flexDirection: 'row' },
  drawer: { width: SIDEBAR_W, backgroundColor: theme.colors.surface, padding: 16, borderRightWidth: 1, borderRightColor: theme.colors.border, height: '100%' },
});
