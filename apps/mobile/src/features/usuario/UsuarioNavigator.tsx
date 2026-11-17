// Módulo funcionario-usuario — híbrido: Tabs en native, AppShell compartido en web (RF-05/06/08/09)
import * as React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigationProp } from '@react-navigation/native';
import { AppShell, IconInbox, IconPlus, IconUser, NotificationBell, theme } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import { MisSolicitudesScreen } from '../tickets/MisSolicitudesScreen';
import { TicketDetailScreen } from '../tickets/TicketDetailScreen';
import type { UsuarioStackParamList } from '../../navigation/types';
import { PerfilScreen } from '../perfil/PerfilScreen';
import { useAuth } from '../../context/AuthContext';
import { screenOpts, tabOpts } from '../../navigation/nav-options';

const Stack = createNativeStackNavigator<UsuarioStackParamList>();
const Tab = createBottomTabNavigator();

function titleFor(name: keyof UsuarioStackParamList) {
  if (name === 'Perfil') return 'Mi perfil';
  if (name === 'CrearTicket') return 'Nueva solicitud';
  if (name === 'DetalleTicket') return 'Detalle';
  return 'Mis solicitudes';
}

// --- Stack interno para bandeja (lista + detalle)
function MisStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="MisSolicitudes" options={{ title: 'Mis solicitudes' }} component={MisSolicitudesScreen} />
      <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={TicketDetailScreen} />
    </Stack.Navigator>
  );
}

// --- Web: AppShell unificado (mismo header/sidebar/footer que el resto de módulos)
function UsuarioWeb() {
  const [activeName, setActiveName] = React.useState<keyof UsuarioStackParamList>('MisSolicitudes');
  const [nav, setNav] = React.useState<NavigationProp<UsuarioStackParamList> | null>(null);
  const { profile, signOut } = useAuth();

  const isActive = (id: string) => {
    if (id === 'mis') return activeName === 'MisSolicitudes' || activeName === 'DetalleTicket';
    if (id === 'crear') return activeName === 'CrearTicket';
    return activeName === 'Perfil';
  };
  const navigate = React.useCallback(
    (name: keyof UsuarioStackParamList) => {
      if (activeName === name) return;
      nav?.navigate(name as never);
    },
    [activeName, nav],
  );
  const iconColor = (active: boolean) => (active ? theme.colors.primaryDark : theme.colors.muted);
  const items = [
    { id: 'mis', label: 'Mis solicitudes', active: isActive('mis'), onPress: () => navigate('MisSolicitudes'), icon: <IconInbox size={14} color={iconColor(isActive('mis'))} /> },
    { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigate('CrearTicket'), icon: <IconPlus size={14} color={iconColor(isActive('crear'))} /> },
    { id: 'perfil', label: 'Mi perfil', active: isActive('perfil'), onPress: () => navigate('Perfil'), icon: <IconUser size={14} color={iconColor(isActive('perfil'))} /> },
  ];

  return (
    <AppShell
      items={items}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Usuario') as string, role: profile.rol, avatarUrl: profile.avatar_url } : undefined}
      onLogout={signOut}
      onUserPress={() => navigate('Perfil')}
      topTitle={titleFor(activeName)}
      headerAction={<NotificationBell client={supabase} onOpenTicket={(id: string) => nav?.navigate('DetalleTicket', { id })} />}
    >
      <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }}>
        <Stack.Screen name="MisSolicitudes" component={MisSolicitudesScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation); setActiveName('MisSolicitudes'); } })} />
        <Stack.Screen name="CrearTicket" component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation); setActiveName('CrearTicket'); } })} />
        <Stack.Screen name="DetalleTicket" component={TicketDetailScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
        <Stack.Screen name="Perfil" component={PerfilScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation); setActiveName('Perfil'); } })} />
      </Stack.Navigator>
    </AppShell>
  );
}

// --- Native: Bottom Tabs (Mis solicitudes + Nueva + Perfil)
function UsuarioMobileTabs() {
  return (
    <Tab.Navigator screenOptions={tabOpts}>
      <Tab.Screen
        name="MisTab"
        options={{
          title: 'Solicitudes',
          tabBarLabel: 'Mis solicitudes',
          tabBarIcon: ({ color }) => <IconInbox size={18} color={color} />,
        }}
        component={MisStack}
      />
      <Tab.Screen
        name="CrearTicket"
        options={{
          ...screenOpts,
          title: 'Nueva',
          tabBarLabel: 'Nueva',
          tabBarIcon: ({ color }) => <IconPlus size={20} color={color} />,
          headerShown: true,
        }}
        component={CreateTicketScreen}
      />
      <Tab.Screen
        name="PerfilTab"
        options={{
          ...screenOpts,
          title: 'Mi perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => <IconUser size={16} color={color} />,
          headerShown: true,
        }}
        component={PerfilScreen}
      />
    </Tab.Navigator>
  );
}

export function UsuarioNavigator() {
  if (Platform.OS === 'web') return <UsuarioWeb />;
  return <UsuarioMobileTabs />;
}
