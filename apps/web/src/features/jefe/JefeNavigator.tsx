// JefeNavigator — AppShell unificado con sidebar + header + footer
import * as React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, AppShell, NotificationBell, IconLayers, IconPlus, IconTag, IconUpload } from '@helpdesk/shared';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { ReportesScreen } from './ReportesScreen';
import { AlertasIAScreen } from './AlertasIAScreen';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import { TicketDetailScreen } from '../tickets/TicketDetailScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import type { JefeStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const Stack = createNativeStackNavigator<JefeStackParamList>();

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

function titleFor(name: string) {
  if (name === 'Perfil') return 'Mi perfil';
  if (name === 'DetalleTicket') return 'Detalle';
  if (name === 'CrearTicket') return 'Nueva solicitud';
  if (name === 'Reportes') return 'Reportes';
  if (name === 'Alertas') return 'Alertas IA';
  return 'Dashboard';
}

function JefeWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: { full_name?: string | null; email?: string | null; rol: string } | null; signOut: () => void }) {
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<JefeStackParamList> | null>(null);
  const isActive = (id: string) => {
    if (id === 'dashboard') return activeName === 'Dashboard';
    if (id === 'crear') return activeName === 'CrearTicket';
    if (id === 'reportes') return activeName === 'Reportes';
    if (id === 'alertas') return activeName === 'Alertas';
    return false;
  };
  const navigate = (name: string) => {
    if (activeName === name) return;
    try {
      const anyNav = nav as unknown as { getState?: () => { routes: { name: string }[] } };
      const st = anyNav?.getState?.();
      const hasTarget = st?.routes?.some((r) => r.name === name);
      if (hasTarget) { nav?.navigate(name as never); return; }
    } catch {}
    nav?.navigate(name as never);
  };
  const ic = (a: boolean) => (a ? theme.colors.primaryDark : theme.colors.muted);
  const onPerfil = React.useCallback(() => {
    navigate('Perfil');
  }, [navigate]);
  const items = [
    { id: 'dashboard', label: 'Dashboard', active: isActive('dashboard'), onPress: () => navigate('Dashboard'), icon: <IconLayers size={14} color={ic(isActive('dashboard'))} /> },
    { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigate('CrearTicket'), icon: <IconPlus size={14} color={ic(isActive('crear'))} /> },
    { id: 'reportes', label: 'Reportes', active: isActive('reportes'), onPress: () => navigate('Reportes'), icon: <IconUpload size={14} color={ic(isActive('reportes'))} /> },
    { id: 'alertas', label: 'Alertas IA', active: isActive('alertas'), onPress: () => navigate('Alertas'), icon: <IconTag size={14} color={ic(isActive('alertas'))} /> },
  ];

  return (
    <AppShell
      items={items}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Jefe') as string, role: profile.rol, avatarUrl: (profile as any).avatar_url } : undefined}
      onLogout={signOut}
      onUserPress={onPerfil}
      topTitle={titleFor(activeName)}
      headerAction={<NotificationBell client={supabase as any} onOpenTicket={(id: string) => (nav as any)?.navigate('DetalleTicket', { id })} />}
    >
      <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }} initialRouteName="Dashboard">
        <Stack.Screen name="Dashboard" component={DashboardScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Dashboard'); } })} />
        <Stack.Screen name="CrearTicket" component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
        <Stack.Screen name="Reportes" component={ReportesScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Reportes'); } })} />
        <Stack.Screen name="Alertas" component={AlertasIAScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Alertas'); } })} />
        <Stack.Screen name="Perfil" component={PerfilScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Perfil'); } })} />
        <Stack.Screen name="DetalleTicket" component={TicketDetailScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('DetalleTicket'); } })} />
      </Stack.Navigator>
    </AppShell>
  );
}

export function JefeNavigator() {
  const [activeName, setActiveName] = React.useState('Dashboard');
  const { profile, signOut } = useAuth();
  if (Platform.OS !== 'web') {
    // mobile: Tabs simple no necesita sidebar
    return <JefeWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
  }
  return <JefeWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}
