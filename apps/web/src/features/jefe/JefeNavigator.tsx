// JefeNavigator — web AppShell con sidebar + reloj alineado (como Admin/Usuario/Tecnico)
import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, Sidebar, Clock, IconLayers, IconPlus, IconTag, IconUpload } from '@helpdesk/shared';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import type { JefeStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

const Stack = createNativeStackNavigator<JefeStackParamList>();

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: '800' }}>{title}</Text>
      {subtitle ? <Text style={{ opacity: 0.6, textAlign: 'center' }}>{subtitle}</Text> : null}
      <Pressable onPress={signOut} style={{ marginTop: 8, backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar sesión</Text></Pressable>
    </View>
  );
}

function JefeWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: { full_name?: string | null; email?: string | null; rol: string } | null; signOut: () => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<JefeStackParamList> | null>(null);
  const isActive = (id: string) => {
    if (id === 'dashboard') return activeName === 'Dashboard';
    if (id === 'crear') return activeName === 'CrearTicket';
    if (id === 'reportes') return activeName === 'Reportes';
    if (id === 'alertas') return activeName === 'Alertas';
    return false;
  };
  const navigateAndClose = (name: string) => {
    if (activeName === name) { setDrawerOpen(false); return; }
    try {
      const anyNav = nav as unknown as { getState?: () => { routes: { name: string }[] } };
      const st = anyNav?.getState?.();
      const hasTarget = st?.routes?.some((r) => r.name === name);
      if (hasTarget) { nav?.navigate(name as never); setDrawerOpen(false); return; }
    } catch {}
    nav?.navigate(name as never);
    setDrawerOpen(false);
  };
  const ic = (a: boolean) => (a ? theme.colors.primaryDark : theme.colors.muted);
  const items = [
    { id: 'dashboard', label: 'Dashboard', active: isActive('dashboard'), onPress: () => navigateAndClose('Dashboard'), icon: <IconLayers size={14} color={ic(isActive('dashboard'))} /> },
    { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigateAndClose('CrearTicket'), icon: <IconPlus size={14} color={ic(isActive('crear'))} /> },
    { id: 'reportes', label: 'Reportes', active: isActive('reportes'), onPress: () => navigateAndClose('Reportes'), icon: <IconUpload size={14} color={ic(isActive('reportes'))} /> },
    { id: 'alertas', label: 'Alertas IA', active: isActive('alertas'), onPress: () => navigateAndClose('Alertas'), icon: <IconTag size={14} color={ic(isActive('alertas'))} /> },
  ];
  const sidebarContent = <Sidebar items={items as never} user={profile ? { name: (profile.full_name ?? profile.email ?? 'Jefe') as string, role: profile.rol } : undefined} onLogout={signOut} />;
  React.useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);
  React.useEffect(() => { setDrawerOpen(false); }, [activeName]);
  if (isDesktop) {
    return (
      <View style={w.root}>
        <View style={w.sidebar}>{sidebarContent}</View>
        <View style={w.main}>
          <View style={w.topClockBar}><Clock /></View>
          <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={screenOpts} initialRouteName="Dashboard">
              <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Dashboard'); } })} />
              <Stack.Screen name="CrearTicket" component={CreateTicketScreen} options={{ title: 'Nueva solicitud' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
              <Stack.Screen name="Reportes" options={{ title: 'Reportes' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Reportes'); } })}>{() => <Placeholder title="Reportes" subtitle="Exportación PDF/CSV" />}</Stack.Screen>
              <Stack.Screen name="Alertas" options={{ title: 'Alertas IA' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Alertas'); } })}>{() => <Placeholder title="Alertas IA" subtitle="Anomalías y picos" />}</Stack.Screen>
            </Stack.Navigator>
          </View>
        </View>
      </View>
    );
  }
  const mobileTitle = activeName === 'CrearTicket' ? 'Nueva solicitud' : activeName === 'Reportes' ? 'Reportes' : activeName === 'Alertas' ? 'Alertas IA' : 'Dashboard';
  return (
    <View style={w.rootMobile}>
      <View style={w.mobileTopBar}>
        <Pressable onPress={() => setDrawerOpen((v) => !v)} style={w.burger} accessibilityRole="button" accessibilityLabel="Abrir menú"><Text style={w.burgerText}>☰</Text></Pressable>
        <Text style={w.mobileTitle}>{mobileTitle}</Text>
        <View style={w.clockMobile}><Clock size={13} /></View>
      </View>
      <View style={w.mainMobile}>
        <View style={{ flex: 1 }}>
          <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }} initialRouteName="Dashboard">
            <Stack.Screen name="Dashboard" component={DashboardScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Dashboard'); } })} />
            <Stack.Screen name="CrearTicket" component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
            <Stack.Screen name="Reportes" listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Reportes'); } })}>{() => <Placeholder title="Reportes" subtitle="Exportación PDF/CSV" />}</Stack.Screen>
            <Stack.Screen name="Alertas" listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Alertas'); } })}>{() => <Placeholder title="Alertas IA" subtitle="Anomalías y picos" />}</Stack.Screen>
          </Stack.Navigator>
        </View>
        {drawerOpen ? <Pressable style={w.overlay} onPress={() => setDrawerOpen(false)}><View style={w.drawer}>{sidebarContent}</View></Pressable> : null}
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
  clockMobile: { minWidth: 80, alignItems: 'flex-end' },
  topClockBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  mobileTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 50, flexDirection: 'row' },
  drawer: { width: 256, backgroundColor: theme.colors.surface, padding: 16, borderRightWidth: 1, borderRightColor: theme.colors.border, height: '100%' },
});

export function JefeNavigator() {
  const [activeName, setActiveName] = React.useState('Dashboard');
  const { profile, signOut } = useAuth();
  if (Platform.OS !== 'web') {
    // mobile: Tabs simple no necesita sidebar
    return <JefeWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
  }
  return <JefeWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}
