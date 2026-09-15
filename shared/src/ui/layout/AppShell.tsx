// AppShell unificado — único header + sidebar + footer para todos los módulos web.
// Corrige: (1) reflow de la card de perfil al colapsar (ancho interno fijo + swap diferido),
// (2) avatar del riel colapsado (usa avatarUrl, no iniciales por defecto).
import * as React from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { theme } from '../theme.js';
import { Sidebar, type SidebarItem } from './Sidebar.js';
import { AppFooter } from './AppFooter.js';
import { Clock } from '../Clock.js';

export const APPSHELL_SIDEBAR_W = 256;
export const APPSHELL_RAIL_W = 72;
export const APPSHELL_BREAKPOINT = 1024;
// Ancho interno fijo del contenido expandido (256 - padding 16*2) para que al
// animar el contenedor el contenido se recorte (clip) en vez de refluir.
const EXPANDED_INNER_W = APPSHELL_SIDEBAR_W - 32;

export type AppShellUser = { name: string; role: string; avatarUrl?: string | null };

export type AppShellProps = {
  items: SidebarItem[];
  user?: AppShellUser;
  onLogout: () => void;
  onUserPress?: () => void;
  topTitle: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  showFooter?: boolean;
  collapsible?: boolean;
};

function RailAvatar({ user, onPress }: { user?: AppShellUser; onPress?: () => void }) {
  const initials = ((user?.name ?? 'U') as string).slice(0, 2).toUpperCase();
  const body = user?.avatarUrl ? (
    <Image source={{ uri: user.avatarUrl }} style={s.railAvatarImg} accessibilityLabel="Foto de perfil" />
  ) : (
    <View style={s.railAvatarFallback}>
      <Text style={s.railAvatarText}>{initials}</Text>
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Abrir mi perfil" style={s.railAvatarBtn}>
        {body}
      </Pressable>
    );
  }
  return <View style={s.railAvatarBtn}>{body}</View>;
}

export function AppShell({
  items,
  user,
  onLogout,
  onUserPress,
  topTitle,
  headerAction,
  children,
  showFooter = true,
  collapsible = true,
}: AppShellProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= APPSHELL_BREAKPOINT;
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  // Contenido visible durante la animación: evita el swap instantáneo que
  // comprimía la card de perfil (reflow) mientras el ancho aún se animaba.
  const [displayCollapsed, setDisplayCollapsed] = React.useState(false);
  const sidebarW = React.useRef(new Animated.Value(APPSHELL_SIDEBAR_W)).current;

  React.useEffect(() => {
    const toValue = collapsed ? APPSHELL_RAIL_W : APPSHELL_SIDEBAR_W;
    if (!collapsed) setDisplayCollapsed(false);
    Animated.timing(sidebarW, { toValue, duration: 240, useNativeDriver: false }).start(({ finished }) => {
      if (finished) setDisplayCollapsed(collapsed);
    });
  }, [collapsed, sidebarW]);

  // Cerrar drawer al pasar a desktop o al cambiar de sección
  React.useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [topTitle]);

  const wrapPress = React.useCallback(
    (fn?: () => void) => () => {
      fn?.();
      setDrawerOpen(false);
    },
    [],
  );
  const wrappedItems = React.useMemo(
    () => items.map((it) => ({ ...it, onPress: wrapPress(it.onPress) })),
    [items, wrapPress],
  );

  const sidebarContent = (
    <View style={s.sidebarInnerFixed}>
      <Sidebar items={wrappedItems} user={user} onLogout={onLogout} onUserPress={onUserPress ? wrapPress(onUserPress) : undefined} />
    </View>
  );

  const collapsedRail = (
    <View style={s.railInner}>
      <View style={s.railHead}>
        <View style={s.railLogo} accessibilityRole="image" accessibilityLabel="Mesa de Ayuda">
          <Text style={s.railLogoText}>◈</Text>
        </View>
      </View>
      {wrappedItems.map((it) => (
        <Pressable
          key={it.id}
          onPress={it.onPress}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          style={[s.railBtn, it.active && s.railBtnActive]}
        >
          {it.icon ?? <Text style={s.railLogoutText}>•</Text>}
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <RailAvatar user={user} onPress={onUserPress ? wrapPress(onUserPress) : undefined} />
      <Pressable onPress={onLogout} accessibilityRole="button" accessibilityLabel="Cerrar sesión" style={s.railBtn}>
        <Text style={s.railLogoutText}>⏻</Text>
      </Pressable>
    </View>
  );

  if (isDesktop) {
    const showRail = collapsible && displayCollapsed;
    return (
      <View style={s.root}>
        <Animated.View style={[s.sidebar, { width: sidebarW }]}>{showRail ? collapsedRail : sidebarContent}</Animated.View>
        <View style={s.main}>
          <View style={s.topClockBar}>
            <Text style={s.topTitle} numberOfLines={1}>
              {topTitle}
            </Text>
            <View style={s.topRight}>
              {headerAction}
              <Clock />
            </View>
          </View>
          {collapsible ? (
            <Pressable
              onPress={() => setCollapsed((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={collapsed ? 'Expandir menú' : 'Contraer menú'}
              style={s.edgeHandle}
            >
              <Text style={s.edgeHandleText}>{collapsed ? '›' : '‹'}</Text>
            </Pressable>
          ) : null}
          <View style={s.content}>{children}</View>
          {showFooter ? <AppFooter /> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={s.rootMobile}>
      <View style={s.mobileTopBar}>
        <Pressable onPress={() => setDrawerOpen((v) => !v)} style={s.burger} accessibilityRole="button" accessibilityLabel="Abrir menú">
          <Text style={s.burgerText}>☰</Text>
        </Pressable>
        <Text style={s.mobileTitle} numberOfLines={1}>
          {topTitle}
        </Text>
        <View style={s.mobileRight}>
          {headerAction}
          <View style={s.clockMobile}>
            <Clock size={13} />
          </View>
        </View>
      </View>
      <View style={s.mainMobile}>
        <View style={s.content}>{children}</View>
        {showFooter ? <AppFooter /> : null}
        {drawerOpen ? (
          <Pressable style={s.overlay} onPress={() => setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar menú">
            <View style={s.drawer}>{sidebarContent}</View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.bg },
  rootMobile: { flex: 1, flexDirection: 'column', backgroundColor: theme.colors.bg },
  sidebar: {
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
    overflow: 'hidden',
  },
  // Ancho fijo: el recorte durante el colapso es limpio, sin reflow de la userCard
  sidebarInnerFixed: { width: EXPANDED_INNER_W, flex: 1 },
  main: { flex: 1, minWidth: 0 as unknown as number, flexDirection: 'column' as const, position: 'relative' as const },
  mainMobile: { flex: 1, minWidth: 0 as unknown as number, position: 'relative', flexDirection: 'column' as const },
  content: { flex: 1, minHeight: 0 as unknown as number },
  topClockBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 100,
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3, flex: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 8,
    height: 56,
    zIndex: 100,
  },
  burger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  burgerText: { fontSize: 18, color: theme.colors.text },
  mobileTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, flex: 1, textAlign: 'center' },
  mobileRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clockMobile: { minWidth: 80, alignItems: 'flex-end' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.35)',
    zIndex: 50,
    flexDirection: 'row',
  },
  drawer: {
    width: APPSHELL_SIDEBAR_W,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    height: '100%',
  },
  edgeHandle: {
    position: 'absolute',
    left: -13,
    top: '50%',
    marginTop: -24,
    width: 26,
    height: 48,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  edgeHandleText: { fontSize: 15, color: theme.colors.muted, fontWeight: '800', lineHeight: 15 },
  railInner: { flex: 1, alignItems: 'center', gap: 10, width: APPSHELL_RAIL_W - 32 },
  railHead: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    width: '100%',
  },
  railLogo: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  railLogoText: { color: '#fff', fontWeight: '800', fontSize: 14, lineHeight: 14 },
  railBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  railBtnActive: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: '#BFDBFE' },
  railAvatarBtn: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  railAvatarImg: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.border },
  railAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  railAvatarText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  railLogoutText: { fontSize: 16, color: theme.colors.muted, fontWeight: '800' },
});
