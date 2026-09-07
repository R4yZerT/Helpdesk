// Módulo funcionario-usuario — híbrido: Tabs en native, AppShell sidebar en web (RF-05/06/08/09)
import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '@helpdesk/shared';
import { Sidebar } from '@helpdesk/shared';
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

// --- Web: sidebar fijo w-64 + Stack a la derecha (reusa Sidebar DS)
function UsuarioWeb() {
  const [activeName, setActiveName] = React.useState('MisSolicitudes');
  const { profile, signOut } = useAuth();
  return <UsuarioWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}

function UsuarioWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: Profile | null; signOut: () => void }) {
  // hook debe estar dentro de NavigationContainer → lo está (UsuarioNavigator es child de Root)
  // Para navegar desde sidebar necesitamos navigation del Stack interno — creamos ref interno
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<UsuarioStackParamList> | null>(null);
  const isActive = (id: string) => {
    if (id === 'mis') return activeName === 'MisSolicitudes' || activeName === 'DetalleTicket' || activeName === 'MisStack';
    if (id === 'crear') return activeName === 'CrearTicket';
    return false;
  };
  return (
    <View style={w.root}>
      <View style={w.sidebar}>
        <Sidebar
          items={[
            { id: 'mis', label: 'Mis solicitudes', active: isActive('mis'), onPress: () => nav?.navigate('MisSolicitudes' as never) },
            { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => nav?.navigate('CrearTicket' as never) },
          ]}
          user={profile ? { name: (profile.full_name ?? profile.email ?? 'Usuario') as string, role: profile.rol } : undefined}
          footer={
            <Pressable onPress={signOut} style={w.logoutBtn}>
              <Text style={w.logoutText}>Cerrar sesión</Text>
            </Pressable>
          }
        />
      </View>
      <View style={w.main}>
        <Stack.Navigator screenOptions={screenOpts}>
          <Stack.Screen name="MisSolicitudes" options={{ title: 'Mis solicitudes' }} component={MisSolicitudesScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MisSolicitudes'); } })} />
          <Stack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
          <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={TicketDetailScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
        </Stack.Navigator>
      </View>
    </View>
  );
}

const w = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.bg },
  sidebar: { width: 256, backgroundColor: theme.colors.surface, borderRightWidth: 1, borderRightColor: theme.colors.border, padding: 16 },
  main: { flex: 1, minWidth: 0 as unknown as number },
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
