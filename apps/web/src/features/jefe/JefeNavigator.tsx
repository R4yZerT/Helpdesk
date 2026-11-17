// JefeNavigator — AppShell unificado con sidebar + header + footer
import * as React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigationProp } from '@react-navigation/native';
import { theme, AppShell, APP_HEADER_OPTIONS, NotificationBell, IconLayers, IconPlus, IconTag, withScreenBoundary } from '@helpdesk/shared';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { AlertasIAScreen } from './AlertasIAScreen';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import { TicketDetailScreen } from '../tickets/TicketDetailScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import type { JefeStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { reportError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';

const Stack = createNativeStackNavigator<JefeStackParamList>();

const DashboardAislado = withScreenBoundary(DashboardScreen, {
  titulo: 'El dashboard no pudo cargarse',
  onError: (error) => reportError(error, { flujo: 'jefe-dashboard' }),
});
const CrearTicketAislado = withScreenBoundary(CreateTicketScreen, {
  titulo: 'La nueva solicitud no pudo cargarse',
  onError: (error) => reportError(error, { flujo: 'jefe-crear-ticket' }),
});
const AlertasAisladas = withScreenBoundary(AlertasIAScreen, {
  titulo: 'Las alertas IA no pudieron cargarse',
  onError: (error) => reportError(error, { flujo: 'jefe-alertas-ia' }),
});
const PerfilAislado = withScreenBoundary(PerfilScreen, {
  titulo: 'El perfil no pudo cargarse',
  onError: (error) => reportError(error, { flujo: 'jefe-perfil' }),
});
const DetalleAislado = withScreenBoundary(TicketDetailScreen, {
  titulo: 'El detalle del ticket no pudo cargarse',
  onError: (error) => reportError(error, { flujo: 'jefe-detalle-ticket' }),
});

function titleFor(name: string) {
  if (name === 'Perfil') return 'Mi perfil';
  if (name === 'DetalleTicket') return 'Detalle';
  if (name === 'CrearTicket') return 'Nueva solicitud';
  if (name === 'Alertas') return 'Alertas IA';
  return 'Dashboard';
}

function JefeWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: { full_name?: string | null; email?: string | null; rol: string } | null; signOut: () => void }) {
  const navRef = React.useRef<NavigationProp<JefeStackParamList> | null>(null);
  const isActive = (id: string) => {
    if (id === 'dashboard') return activeName === 'Dashboard';
    if (id === 'crear') return activeName === 'CrearTicket';
    if (id === 'alertas') return activeName === 'Alertas';
    return false;
  };
  const navigate = React.useCallback((name: keyof JefeStackParamList) => {
    if (activeName === name) return;
    navRef.current?.navigate(name as never);
  }, [activeName]);
  const ic = (a: boolean) => (a ? theme.colors.primaryDark : theme.colors.muted);
  const onPerfil = React.useCallback(() => {
    navigate('Perfil');
  }, [navigate]);
  const items = [
    { id: 'dashboard', label: 'Dashboard', active: isActive('dashboard'), onPress: () => navigate('Dashboard'), icon: <IconLayers size={14} color={ic(isActive('dashboard'))} /> },
    { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigate('CrearTicket'), icon: <IconPlus size={14} color={ic(isActive('crear'))} /> },
    { id: 'alertas', label: 'Alertas IA', active: isActive('alertas'), onPress: () => navigate('Alertas'), icon: <IconTag size={14} color={ic(isActive('alertas'))} /> },
  ];

  return (
    <AppShell
      items={items}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Jefe') as string, role: profile.rol, avatarUrl: (profile as any).avatar_url } : undefined}
      onLogout={signOut}
      onUserPress={onPerfil}
      topTitle={titleFor(activeName)}
      headerAction={<NotificationBell client={supabase as any} onOpenTicket={(id: string) => navRef.current?.navigate('DetalleTicket', { id })} />}
    >
      <Stack.Navigator screenOptions={{ ...APP_HEADER_OPTIONS, headerShown: false }} initialRouteName="Dashboard">
        <Stack.Screen name="Dashboard" component={DashboardAislado} listeners={({ navigation }) => ({ focus: () => { navRef.current = navigation; setActiveName('Dashboard'); } })} />
        <Stack.Screen name="CrearTicket" component={CrearTicketAislado} listeners={({ navigation }) => ({ focus: () => { navRef.current = navigation; setActiveName('CrearTicket'); } })} />
        <Stack.Screen name="Alertas" component={AlertasAisladas} listeners={({ navigation }) => ({ focus: () => { navRef.current = navigation; setActiveName('Alertas'); } })} />
        <Stack.Screen name="Perfil" component={PerfilAislado} listeners={({ navigation }) => ({ focus: () => { navRef.current = navigation; setActiveName('Perfil'); } })} />
        <Stack.Screen name="DetalleTicket" component={DetalleAislado} listeners={({ navigation }) => ({ focus: () => { navRef.current = navigation; setActiveName('DetalleTicket'); } })} />
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
