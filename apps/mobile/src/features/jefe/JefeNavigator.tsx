// JefeNavigator móvil — Tabs: Dashboard (RF-16/17/18) · Alertas IA (RF-24) · Nueva · Perfil
// Dashboard reutiliza DashboardScreen (shared); Alertas usa AlertasIAScreen.
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '@helpdesk/shared';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { AlertasIAScreen } from './AlertasIAScreen';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import { DetalleTecnicoScreen } from '../tecnico/DetalleTecnicoScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import { HeaderBell } from '../../components/HeaderBell';
import type { JefeStackParamList } from '../../navigation/types';

const Stack = createNativeStackNavigator<JefeStackParamList>();
const Tab = createBottomTabNavigator();

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  headerRight: () => <HeaderBell />,
  contentStyle: { backgroundColor: theme.colors.bg },
};

const tabOpts = {
  headerShown: false as const,
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: theme.colors.muted,
  tabBarStyle: { height: 62, paddingTop: 6, paddingBottom: 8, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
};

function JefeMainStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Dashboard" options={{ title: 'Dashboard', headerShown: false }} component={DashboardScreen} />
      <Stack.Screen name="Alertas" options={{ title: 'Alertas IA' }} component={AlertasIAScreen} />
      <Stack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CreateTicketScreen} />
      <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleTecnicoScreen} />
    </Stack.Navigator>
  );
}

export function JefeNavigator() {
  return (
    <Tab.Navigator screenOptions={tabOpts}>
      <Tab.Screen name="JefeDashTab" options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>▦</Text> }} component={JefeMainStack} />
      <Tab.Screen name="JefeCrearTab" options={{ tabBarLabel: 'Nueva', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>＋</Text>, headerShown: true, headerTitle: 'Nueva solicitud', headerStyle: { backgroundColor: theme.colors.surface } as never, headerTintColor: theme.colors.primary, headerRight: () => <HeaderBell /> }} component={CreateTicketScreen} />
      <Tab.Screen name="JefePerfilTab" options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>◉</Text>, headerShown: true, headerTitle: 'Mi perfil', headerRight: () => <HeaderBell /> }} component={PerfilScreen} />
    </Tab.Navigator>
  );
}
