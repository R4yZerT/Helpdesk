// Módulo funcionario-usuario — híbrido: Tabs en native, AppShell sidebar en web (RF-05/06/08/09)
import * as React from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { theme, Sidebar, IconInbox, IconPlus, Clock, NotificationBell } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import { MisSolicitudesScreen } from '../tickets/MisSolicitudesScreen';
import { TicketDetailScreen } from '../tickets/TicketDetailScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import type { UsuarioStackParamList } from '../../navigation/types';
import type { Profile } from '@helpdesk/shared';
import { useAuth } from '../../context/AuthContext';

const Stack = createNativeStackNavigator<UsuarioStackParamList>();
const Tab = createBottomTabNavigator();

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

// --- Stack interno para bandeja (lista + detalle)
function MisStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="MisSolicitudes" options={{ title: 'Mis solicitudes' }} component={MisSolicitudesScreen} />
      <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={TicketDetailScreen} />
    </Stack.Navigator>
  );
}

// --- Web: AppShell estándar — sidebar w-64 fijo (BREAKPOINT 1024) + drawer overlay móvil
// Estandarizado con shared/src/ui/layout/AppShell.tsx (SIDEBAR_W 256, BREAKPOINT 1024, overlay rgba)
// Usado en DashboardScreen y todas las vistas web con sidebar
function UsuarioWeb() {
  const [activeName, setActiveName] = React.useState('MisSolicitudes');
  const { profile, signOut } = useAuth();
  return <UsuarioWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}

function UsuarioWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: Profile | null; signOut: () => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024; // BREAKPOINT AppShell estándar
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const sidebarW = React.useRef(new Animated.Value(256)).current;
  const drawerX = React.useRef(new Animated.Value(-280)).current;
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<UsuarioStackParamList> | null>(null);
  // Animación suave del sidebar desktop (256 <-> 72)
  React.useEffect(() => {
    Animated.timing(sidebarW, { toValue: collapsed ? 72 : 256, duration: 240, useNativeDriver: false }).start();
  }, [collapsed, sidebarW]);
  // Animación de entrada del drawer móvil (slide desde la izquierda)
  React.useEffect(() => {
    if (drawerOpen) {
      drawerX.setValue(-280);
      Animated.timing(drawerX, { toValue: 0, duration: 240, useNativeDriver: false }).start();
    }
  }, [drawerOpen, drawerX]);
  const isActive = (id: string) => {
    if (id === 'mis') return activeName === 'MisSolicitudes' || activeName === 'DetalleTicket' || activeName === 'MisStack';
    if (id === 'crear') return activeName === 'CrearTicket';
    return false;
  };
  // Fix pantalla blanca: evita navegar si ya está en la ruta; si vuelve a raíz (MisSolicitudes) hace popToTop
  const navigateAndClose = (name: string) => {
    if (activeName === name) { setDrawerOpen(false); return; }
    try {
      const anyNav = nav as unknown as { getState?: () => { routes: { name: string }[]; index: number }; popToTop?: () => void };
      const st = anyNav?.getState?.();
      const hasTarget = st?.routes?.some((r) => r.name === name);
      const isRoot = name === 'MisSolicitudes';
      if (hasTarget && isRoot && typeof anyNav?.popToTop === 'function') {
        anyNav.popToTop();
        const st2 = anyNav.getState?.();
        if (st2?.routes?.[st2.index]?.name !== name) nav?.navigate(name as never);
        setDrawerOpen(false);
        return;
      }
    } catch {}
    nav?.navigate(name as never);
    setDrawerOpen(false);
  };
  const iconColor = (a: boolean) => (a ? theme.colors.primaryDark : theme.colors.muted);
  const onPerfil = React.useCallback(() => {
    // Perfil ahora vive dentro del Stack interno -> navega directo con layout sidebar+header preservado
    navigateAndClose('Perfil');
  }, [navigateAndClose]);
  const sidebarContent = (
    <Sidebar
      items={[
        { id: 'mis', label: 'Mis solicitudes', active: isActive('mis'), onPress: () => navigateAndClose('MisSolicitudes'), icon: <IconInbox size={14} color={iconColor(isActive('mis'))} /> },
        { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigateAndClose('CrearTicket'), icon: <IconPlus size={14} color={iconColor(isActive('crear'))} /> },
      ]}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Usuario') as string, role: profile.rol, avatarUrl: profile.avatar_url } : undefined}
      onLogout={signOut}
      onUserPress={onPerfil}
    />
  );

  // Riel colapsado: misma cabecera de 56px que el Sidebar expandido para que el logo
  // no cambie de tamaño ni se acorte el espacio superior; solo iconos debajo
  const collapsedRail = (
    <View style={w.railInner}>
      <View style={w.railHead}>
        <View style={w.railLogo} accessibilityRole="image" accessibilityLabel="Mesa de Ayuda"><Text style={w.railLogoText}>◈</Text></View>
      </View>
      <Pressable onPress={() => navigateAndClose('MisSolicitudes')} accessibilityRole="button" accessibilityLabel="Mis solicitudes" style={[w.railBtn, isActive('mis') && w.railBtnActive]}>
        <IconInbox size={16} color={iconColor(isActive('mis'))} />
      </Pressable>
      <Pressable onPress={() => navigateAndClose('CrearTicket')} accessibilityRole="button" accessibilityLabel="Nueva solicitud" style={[w.railBtn, isActive('crear') && w.railBtnActive]}>
        <IconPlus size={16} color={iconColor(isActive('crear'))} />
      </Pressable>
      <View style={{ flex: 1 }} />
      <Pressable onPress={onPerfil} accessibilityRole="button" accessibilityLabel="Abrir mi perfil" style={w.railAvatar}>
        <Text style={w.railAvatarText}>{((profile?.full_name ?? profile?.email ?? 'U') as string).slice(0, 2).toUpperCase()}</Text>
      </Pressable>
      <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="Cerrar sesión" style={w.railBtn}>
        <Text style={w.railLogoutText}>⏻</Text>
      </Pressable>
    </View>
  );

  // Cerrar drawer al pasar a desktop
  React.useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  // Cerrar drawer al cambiar de sección
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [activeName]);

  if (isDesktop) {
    return (
      <View style={w.root}>
        <Animated.View style={[w.sidebar, { width: sidebarW }]}>
          {collapsed ? collapsedRail : sidebarContent}
        </Animated.View>
        <View style={w.main}>
          <View style={w.topClockBar}><Text style={w.topTitle}>{activeName === 'Perfil' ? 'Mi perfil' : activeName === 'CrearTicket' ? 'Nueva solicitud' : activeName === 'DetalleTicket' ? 'Detalle' : 'Mis solicitudes'}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><NotificationBell client={supabase as any} onOpenTicket={(id: string) => (nav as any)?.navigate('DetalleTicket', { id })} /><Clock /></View></View>
          {/* Tirador flotante sobre el borde sidebar/contenido: fuera del header, más discreto y bonito */}
          <Pressable onPress={() => setCollapsed((v) => !v)} accessibilityRole="button" accessibilityLabel={collapsed ? 'Expandir menú' : 'Contraer menú'} style={w.edgeHandle}>
            <Text style={w.edgeHandleText}>{collapsed ? '›' : '‹'}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }}>
            <Stack.Screen name="MisSolicitudes" component={MisSolicitudesScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MisSolicitudes'); } })} />
            <Stack.Screen name="CrearTicket" component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
            <Stack.Screen name="DetalleTicket" component={TicketDetailScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
            <Stack.Screen name="Perfil" component={PerfilScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Perfil'); } })} />
            </Stack.Navigator>
          </View>
        </View>
      </View>
    );
  }

  // Móvil / tablet estrecho: header con burger + drawer overlay (no ocupa 60% fijo)
  const mobileTitle = activeName === 'Perfil' ? 'Mi perfil' : activeName === 'CrearTicket' ? 'Nueva solicitud' : activeName === 'DetalleTicket' ? 'Detalle' : 'Mis solicitudes';
  return (
    <View style={w.rootMobile}>
      <View style={w.mobileTopBar}>
        <Pressable onPress={() => setDrawerOpen((v) => !v)} style={w.burger} accessibilityRole="button" accessibilityLabel="Abrir menú">
          <Text style={w.burgerText}>☰</Text>
        </Pressable>
        <Text style={w.mobileTitle}>{mobileTitle}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><NotificationBell client={supabase as any} onOpenTicket={(id: string) => (nav as any)?.navigate('DetalleTicket', { id })} /><View style={w.clockMobile}><Clock size={13} /></View></View>
      </View>
      <View style={w.mainMobile}>
        <View style={{ flex: 1 }}>
          <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }}>
          <Stack.Screen name="MisSolicitudes" component={MisSolicitudesScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MisSolicitudes'); } })} />
          <Stack.Screen name="CrearTicket" component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
          <Stack.Screen name="DetalleTicket" component={TicketDetailScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
          <Stack.Screen name="Perfil" component={PerfilScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Perfil'); } })} />
          </Stack.Navigator>
        </View>
        {drawerOpen ? (
          <Pressable style={w.overlay} onPress={() => setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar menú">
            <Animated.View style={[w.drawer, { transform: [{ translateX: drawerX }] }]}>{sidebarContent}</Animated.View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const w = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.bg },
  rootMobile: { flex: 1, flexDirection: 'column', backgroundColor: theme.colors.bg },
  sidebar: { width: 256, backgroundColor: theme.colors.surface, borderRightWidth: 1, borderRightColor: theme.colors.border, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0, overflow: 'hidden' },
  mainMobile: { flex: 1, minWidth: 0 as unknown as number, position: 'relative', flexDirection: 'column' as const },
  mobileTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: 8, height: 56, zIndex: 100, elevation: 10 },
  burger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  burgerText: { fontSize: 18, color: theme.colors.text },
  burgerSpacer: { width: 44 },
  clockMobile: { minWidth: 80, alignItems: 'flex-end' },
  topClockBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, zIndex: 100, elevation: 10 },
  topTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3, flex: 1 },
  mobileTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 50, flexDirection: 'row' },
  drawer: { width: 256, backgroundColor: theme.colors.surface, padding: 16, borderRightWidth: 1, borderRightColor: theme.colors.border, height: '100%' }, // SIDEBAR_W AppShell
  logoutBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  logoutText: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
  main: { flex: 1, minWidth: 0 as unknown as number, flexDirection: 'column' as const, position: 'relative' as const },
  edgeHandle: { position: 'absolute', left: -13, top: '50%', marginTop: -24, width: 26, height: 48, borderRadius: 13, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', zIndex: 200, elevation: 4 },
  edgeHandleText: { fontSize: 15, color: theme.colors.muted, fontWeight: '800', lineHeight: 15 },
  railInner: { flex: 1, alignItems: 'center', gap: 10 },
  railHead: { height: 56, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border, width: '100%' },
  railLogo: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  railLogoText: { color: '#fff', fontWeight: '800', fontSize: 14, lineHeight: 14 },
  railBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  railBtnActive: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: '#BFDBFE' },
  railAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  railAvatarText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  railLogoutText: { fontSize: 16, color: theme.colors.muted, fontWeight: '800' },
});

// --- Native: Bottom Tabs (Mis solicitudes + Nueva + Perfil)
function UsuarioMobileTabs() {
  const { profile } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: { height: 62, paddingTop: 6, paddingBottom: 8, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="MisTab"
        options={{
          title: 'Solicitudes',
          tabBarLabel: 'Mis solicitudes',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☰</Text>,
        }}
        component={MisStack}
      />
      <Tab.Screen
        name="CrearTicket"
        options={{
          title: 'Nueva',
          tabBarLabel: 'Nueva',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>＋</Text>,
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.surface } as never,
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { fontWeight: '800', fontSize: 14 } as never,
        }}
        component={CreateTicketScreen}
      />
      <Tab.Screen
        name="PerfilTab"
        options={{
          title: 'Perfil',
          tabBarLabel: profile?.full_name?.split(' ')[0] ?? 'Perfil',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>◉</Text>,
        }}
      >
        {() => {
          const { signOut } = useAuth();
          return (
            <View style={m.perfilWrap}>
              <View style={m.avatar}><Text style={m.avatarText}>{(profile?.full_name ?? profile?.email ?? 'U').slice(0, 2).toUpperCase()}</Text></View>
              <Text style={m.perfilName}>{profile?.full_name ?? profile?.email}</Text>
              <Text style={m.perfilRole}>{profile?.rol}</Text>
              <Pressable onPress={signOut} style={m.logoutBtn}><Text style={m.logoutText}>Cerrar sesión</Text></Pressable>
            </View>
          );
        }}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const m = StyleSheet.create({
  perfilWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.bg, padding: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  perfilName: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  perfilRole: { fontSize: 12, color: theme.colors.muted, textTransform: 'capitalize' },
  logoutBtn: { marginTop: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  logoutText: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
});

export function UsuarioNavigator() {
  if (Platform.OS === 'web') return <UsuarioWeb />;
  return <UsuarioMobileTabs />;
}
