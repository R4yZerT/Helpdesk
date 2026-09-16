// AdminNavigator — AppShell unificado + sidebar global + footer legal
import * as React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, AppShell, IconUsers, IconLayers, IconTable, IconTag, IconUpload, NotificationBell } from '@helpdesk/shared';
import { AdminUsuariosScreen } from './AdminUsuariosScreen';
import { AdminMesasScreen } from './AdminMesasScreen';
import { AdminMesaTicketsScreen } from './AdminMesaTicketsScreen';
import { AdminCategoriasScreen } from './AdminCategoriasScreen';
import { AdminImportScreen } from './AdminImportScreen';
import { TicketDetailScreen } from '../tickets/TicketDetailScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import type { AdminStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const Stack = createNativeStackNavigator<AdminStackParamList>();

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
  if (name === 'Mesas') return 'Dependencias';
  if (name === 'Usuarios') return 'Usuarios';
  if (name === 'Categorias') return 'Categorías';
  if (name === 'Import') return 'Import';
  return 'Mesas';
}

function AdminWeb() {
  const [activeName, setActiveName] = React.useState('MesaTickets');
  const { profile, signOut } = useAuth();
  return <AdminWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}

function AdminWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: { full_name?: string | null; email?: string | null; rol: string } | null; signOut: () => void }) {
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<AdminStackParamList> | null>(null);

  const mesaId = (profile as unknown as { mesa_id?: number | null })?.mesa_id ?? (profile as unknown as { mesaId?: number | null })?.mesaId ?? null;
  const isGeneralAdmin = mesaId == null;
  const isActive = (id: string) => {
    if (id === 'usuarios') return activeName === 'Usuarios';
    if (id === 'mesas') return activeName === 'Mesas';
    if (id === 'mesaTickets') return activeName === 'MesaTickets';
    if (id === 'categorias') return activeName === 'Categorias';
    if (id === 'import') return activeName === 'Import';
    return false;
  };
  // Fix pantalla blanca: evita navegar duplicado; si el destino ya está en el stack hace navigate limpio
  const navigate = (name: string) => {
    if (activeName === name) return;
    try {
      const anyNav = nav as unknown as { getState?: () => { routes: { name: string }[] }; popToTop?: () => void };
      const st = anyNav?.getState?.();
      const hasTarget = st?.routes?.some((r) => r.name === name);
      if (hasTarget) {
        nav?.navigate(name as never);
        return;
      }
    } catch {}
    nav?.navigate(name as never);
  };
  const ic = (active: boolean) => (active ? theme.colors.primaryDark : theme.colors.muted);
  const onPerfil = React.useCallback(() => {
    navigate('Perfil');
  }, [navigate]);
  const allItems = [
    { id: 'mesaTickets', label: 'MESAS', active: isActive('mesaTickets'), onPress: () => navigate('MesaTickets'), icon: <IconTable size={14} color={ic(isActive('mesaTickets'))} /> },
    ...(isGeneralAdmin ? [{ id: 'mesas', label: 'DEPENDENCIAS', active: isActive('mesas'), onPress: () => navigate('Mesas'), icon: <IconLayers size={14} color={ic(isActive('mesas'))} /> } as const] : []),
    { id: 'usuarios', label: 'USUARIOS', active: isActive('usuarios'), onPress: () => navigate('Usuarios'), icon: <IconUsers size={14} color={ic(isActive('usuarios'))} /> },
    { id: 'categorias', label: 'CATEGORÍAS', active: isActive('categorias'), onPress: () => navigate('Categorias'), icon: <IconTag size={14} color={ic(isActive('categorias'))} /> },
    { id: 'import', label: 'IMPORT', active: isActive('import'), onPress: () => navigate('Import'), icon: <IconUpload size={14} color={ic(isActive('import'))} /> },
  ];

  return (
    <AppShell
      items={allItems as never}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Administrador') as string, role: profile.rol, avatarUrl: (profile as any).avatar_url } : undefined}
      onLogout={signOut}
      onUserPress={onPerfil}
      topTitle={titleFor(activeName)}
      headerAction={<NotificationBell client={supabase as any} onOpenTicket={(id: string) => (nav as any)?.navigate('DetalleTicket', { id })} />}
    >
      <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }} initialRouteName="MesaTickets">
        <Stack.Screen name="MesaTickets" component={AdminMesaTicketsScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MesaTickets'); } })} />
        {isGeneralAdmin ? <Stack.Screen name="Mesas" component={AdminMesasScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Mesas'); } })} /> : null}
        <Stack.Screen name="Usuarios" component={AdminUsuariosScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Usuarios'); } })} />
        <Stack.Screen name="Categorias" component={AdminCategoriasScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Categorias'); } })} />
        <Stack.Screen name="Import" component={AdminImportScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Import'); } })} />
        <Stack.Screen name="Perfil" component={PerfilScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Perfil'); } })} />
        <Stack.Screen name="DetalleTicket" component={TicketDetailScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('DetalleTicket'); } })} />
      </Stack.Navigator>
    </AppShell>
  );
}

export function AdminNavigator() {
  if (Platform.OS === 'web') return <AdminWeb />;
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Usuarios" component={AdminUsuariosScreen} options={{ title: 'Usuarios' }} />
    </Stack.Navigator>
  );
}
