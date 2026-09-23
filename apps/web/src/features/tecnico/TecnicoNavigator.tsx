// TecnicoNavigator — AppShell unificado + sidebar global + footer legal
import * as React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, AppShell, IconInbox, IconPlus, NotificationBell, withScreenBoundary } from '@helpdesk/shared';
import { BandejaTecnicoScreen } from './BandejaTecnicoScreen';
import { DetalleTecnicoScreen } from './DetalleTecnicoScreen';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import type { TecnicoStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { reportError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';

const Stack = createNativeStackNavigator<TecnicoStackParamList>();

// H6 — cada pantalla aislada: si una rompe, el resto del navigator sigue vivo
const BandejaAislada = withScreenBoundary(BandejaTecnicoScreen, { titulo: 'La bandeja no pudo cargarse', onError: (e) => reportError(e, { flujo: 'tecnico-bandeja' }) });
const CrearAislado = withScreenBoundary(CreateTicketScreen, { titulo: 'La creación no pudo cargarse', onError: (e) => reportError(e, { flujo: 'tecnico-crear' }) });
const DetalleAislado = withScreenBoundary(DetalleTecnicoScreen, { titulo: 'El detalle no pudo cargarse', onError: (e) => reportError(e, { flujo: 'tecnico-detalle' }) });
const PerfilAislado = withScreenBoundary(PerfilScreen, { titulo: 'El perfil no pudo cargarse', onError: (e) => reportError(e, { flujo: 'tecnico-perfil' }) });

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

function titleFor(name: string) {
  if (name === 'Perfil') return 'Mi perfil';
  if (name === 'CrearTicket') return 'Nueva solicitud';
  if (name === 'DetalleTicket') return 'Detalle';
  return 'Bandeja';
}

function TecnicoWeb() {
  const [activeName, setActiveName] = React.useState('Bandeja');
  const { profile, signOut } = useAuth();
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<TecnicoStackParamList> | null>(null);

  const isActive = (id: string) => {
    if (id === 'bandeja') return activeName === 'Bandeja' || activeName === 'DetalleTicket';
    if (id === 'crear') return activeName === 'CrearTicket';
    return false;
  };
  // Fix pantalla blanca: si ya está en la ruta no navegar; si el target ya está en el stack hacer popToTop
  const navigate = (name: string) => {
    if (activeName === name) return;
    try {
      const anyNav = nav as unknown as { getState?: () => { routes: { name: string }[]; index: number }; popToTop?: () => void };
      const st = anyNav?.getState?.();
      const hasTarget = st?.routes?.some((r) => r.name === name);
      const isRoot = name === 'Bandeja';
      if (hasTarget && isRoot && typeof anyNav?.popToTop === 'function') {
        anyNav.popToTop();
        const st2 = anyNav.getState?.();
        if (st2?.routes?.[st2.index]?.name !== name) nav?.navigate(name as never);
        return;
      }
    } catch {}
    nav?.navigate(name as never);
  };
  const iconColor = (active: boolean) => (active ? theme.colors.primaryDark : theme.colors.muted);
  const onPerfil = React.useCallback(() => {
    navigate('Perfil');
  }, [navigate]);
  const items = [
    { id: 'bandeja', label: 'Bandeja Asignada', active: isActive('bandeja'), onPress: () => navigate('Bandeja'), icon: <IconInbox size={14} color={iconColor(isActive('bandeja'))} /> },
    { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigate('CrearTicket'), icon: <IconPlus size={14} color={iconColor(isActive('crear'))} /> },
  ];

  return (
    <AppShell
      items={items}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Técnico') as string, role: profile.rol, avatarUrl: (profile as any).avatar_url } : undefined}
      onLogout={signOut}
      onUserPress={onPerfil}
      topTitle={titleFor(activeName)}
      headerAction={<NotificationBell client={supabase as any} onOpenTicket={(id: string) => (nav as any)?.navigate('DetalleTicket', { id })} />}
    >
      <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }}>
        <Stack.Screen name="Bandeja" component={BandejaAislada} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Bandeja'); } })} />
        <Stack.Screen name="CrearTicket" component={CrearAislado} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
        <Stack.Screen name="DetalleTicket" component={DetalleAislado} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
        <Stack.Screen name="Perfil" component={PerfilAislado} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Perfil'); } })} />
      </Stack.Navigator>
    </AppShell>
  );
}

export function TecnicoNavigator() {
  if (Platform.OS === 'web') return <TecnicoWeb />;
  // native: stack simple (tabs previstos)
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Bandeja" options={{ title: 'Bandeja' }} component={BandejaAislada} />
      <Stack.Screen name="CrearTicket" options={{ title: 'Crear solicitud' }} component={CrearAislado} />
      <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleAislado} />
    </Stack.Navigator>
  );
}
