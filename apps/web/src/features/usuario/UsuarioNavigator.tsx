// Módulo funcionario-usuario — híbrido: Tabs en native, AppShell sidebar en web (RF-05/06/08/09)
import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme, Sidebar, IconInbox, IconPlus, Clock } from '@helpdesk/shared';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import { MisSolicitudesScreen } from '../tickets/MisSolicitudesScreen';
import { TicketDetailScreen } from '../tickets/TicketDetailScreen';
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
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<UsuarioStackParamList> | null>(null);
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
  const sidebarContent = (
    <Sidebar
      items={[
        { id: 'mis', label: 'Mis solicitudes', active: isActive('mis'), onPress: () => navigateAndClose('MisSolicitudes'), icon: <IconInbox size={14} color={iconColor(isActive('mis'))} /> },
        { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigateAndClose('CrearTicket'), icon: <IconPlus size={14} color={iconColor(isActive('crear'))} /> },
      ]}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Usuario') as string, role: profile.rol } : undefined}
      onLogout={signOut}
    />
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
        <View style={w.sidebar}>
          {sidebarContent}
        </View>
        <View style={w.main}>
          <View style={w.topClockBar}><Clock /></View>
          <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={screenOpts}>
            <Stack.Screen name="MisSolicitudes" options={{ title: 'Mis solicitudes' }} component={MisSolicitudesScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MisSolicitudes'); } })} />
            <Stack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
            <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={TicketDetailScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
            </Stack.Navigator>
          </View>
        </View>
      </View>
    );
  }

  // Móvil / tablet estrecho: header con burger + drawer overlay (no ocupa 60% fijo)
  const mobileTitle = activeName === 'CrearTicket' ? 'Nueva solicitud' : activeName === 'DetalleTicket' ? 'Detalle' : 'Mis solicitudes';
  return (
    <View style={w.rootMobile}>
      <View style={w.mobileTopBar}>
        <Pressable onPress={() => setDrawerOpen((v) => !v)} style={w.burger} accessibilityRole="button" accessibilityLabel="Abrir menú">
          <Text style={w.burgerText}>☰</Text>
        </Pressable>
        <Text style={w.mobileTitle}>{mobileTitle}</Text>
        <View style={w.clockMobile}><Clock size={13} /></View>
      </View>
      <View style={w.mainMobile}>
        <View style={{ flex: 1 }}>
          <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }}>
          <Stack.Screen name="MisSolicitudes" component={MisSolicitudesScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MisSolicitudes'); } })} />
          <Stack.Screen name="CrearTicket" component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
          <Stack.Screen name="DetalleTicket" component={TicketDetailScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
          </Stack.Navigator>
        </View>
        {drawerOpen ? (
          <Pressable style={w.overlay} onPress={() => setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar menú">
            <View style={w.drawer}>{sidebarContent}</View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const w = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.bg },
  rootMobile: { flex: 1, flexDirection: 'column', backgroundColor: theme.colors.bg },
  sidebar: { width: 256, backgroundColor: theme.colors.surface, borderRightWidth: 1, borderRightColor: theme.colors.border, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 },
  main: { flex: 1, minWidth: 0 as unknown as number, flexDirection: 'column' as const },
  mainMobile: { flex: 1, minWidth: 0 as unknown as number, position: 'relative', flexDirection: 'column' as const },
  mobileTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: 8, height: 56 },
  burger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  burgerText: { fontSize: 18, color: theme.colors.text },
  burgerSpacer: { width: 44 },
  clockMobile: { minWidth: 80, alignItems: 'flex-end' },
  topClockBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  mobileTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 50, flexDirection: 'row' },
  drawer: { width: 256, backgroundColor: theme.colors.surface, padding: 16, borderRightWidth: 1, borderRightColor: theme.colors.border, height: '100%' }, // SIDEBAR_W AppShell
  logoutBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  logoutText: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
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
