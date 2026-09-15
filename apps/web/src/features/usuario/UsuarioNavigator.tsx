// Módulo funcionario-usuario — híbrido: Tabs en native, AppShell unificado en web
import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme, AppShell, IconInbox, IconPlus, NotificationBell } from '@helpdesk/shared';
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

function titleFor(name: string) {
  if (name === 'Perfil') return 'Mi perfil';
  if (name === 'CrearTicket') return 'Nueva solicitud';
  if (name === 'DetalleTicket') return 'Detalle';
  return 'Mis solicitudes';
}

// --- Web: AppShell unificado (mismo header/sidebar/footer que el resto de módulos)
function UsuarioWeb() {
  const [activeName, setActiveName] = React.useState('MisSolicitudes');
  const { profile, signOut } = useAuth();
  return <UsuarioWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}

function UsuarioWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: Profile | null; signOut: () => void }) {
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<UsuarioStackParamList> | null>(null);
  const isActive = (id: string) => {
    if (id === 'mis') return activeName === 'MisSolicitudes' || activeName === 'DetalleTicket' || activeName === 'MisStack';
    if (id === 'crear') return activeName === 'CrearTicket';
    return false;
  };
  // Fix pantalla blanca: evita navegar si ya está en la ruta; si vuelve a raíz hace popToTop
  const navigate = (name: string) => {
    if (activeName === name) return;
    try {
      const anyNav = nav as unknown as { getState?: () => { routes: { name: string }[]; index: number }; popToTop?: () => void };
      const st = anyNav?.getState?.();
      const hasTarget = st?.routes?.some((r) => r.name === name);
      const isRoot = name === 'MisSolicitudes';
      if (hasTarget && isRoot && typeof anyNav?.popToTop === 'function') {
        anyNav.popToTop();
        const st2 = anyNav.getState?.();
        if (st2?.routes?.[st2.index]?.name !== name) nav?.navigate(name as never);
        return;
      }
    } catch {}
    nav?.navigate(name as never);
  };
  const iconColor = (a: boolean) => (a ? theme.colors.primaryDark : theme.colors.muted);
  const onPerfil = React.useCallback(() => {
    navigate('Perfil');
  }, [navigate]);
  const items = [
    { id: 'mis', label: 'Mis solicitudes', active: isActive('mis'), onPress: () => navigate('MisSolicitudes'), icon: <IconInbox size={14} color={iconColor(isActive('mis'))} /> },
    { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigate('CrearTicket'), icon: <IconPlus size={14} color={iconColor(isActive('crear'))} /> },
  ];

  return (
    <AppShell
      items={items}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Usuario') as string, role: profile.rol, avatarUrl: profile.avatar_url } : undefined}
      onLogout={signOut}
      onUserPress={onPerfil}
      topTitle={titleFor(activeName)}
      headerAction={<NotificationBell client={supabase as any} onOpenTicket={(id: string) => (nav as any)?.navigate('DetalleTicket', { id })} />}
    >
      <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }}>
        <Stack.Screen name="MisSolicitudes" component={MisSolicitudesScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MisSolicitudes'); } })} />
        <Stack.Screen name="CrearTicket" component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
        <Stack.Screen name="DetalleTicket" component={TicketDetailScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
        <Stack.Screen name="Perfil" component={PerfilScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Perfil'); } })} />
      </Stack.Navigator>
    </AppShell>
  );
}

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
