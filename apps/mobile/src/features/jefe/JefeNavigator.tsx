// JefeNavigator móvil — Tabs: Dashboard (RF-16/17/18) · Alertas IA (RF-24) · Nueva · Perfil
// Dashboard reutiliza DashboardScreen (shared); Alertas usa AlertasIAScreen.
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IconGrid, IconPlus, IconUser } from '@helpdesk/shared';
import { DashboardScreen } from '../dashboard/DashboardScreen';
import { AlertasIAScreen } from './AlertasIAScreen';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import { DetalleTecnicoScreen } from '../tecnico/DetalleTecnicoScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import { screenOpts, tabOpts } from '../../navigation/nav-options';
import type { JefeStackParamList } from '../../navigation/types';

const Stack = createNativeStackNavigator<JefeStackParamList>();
const Tab = createBottomTabNavigator();

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
      <Tab.Screen name="JefeDashTab" options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ color }) => <IconGrid size={16} color={color} /> }} component={JefeMainStack} />
      <Tab.Screen name="JefeCrearTab" options={{ ...screenOpts, tabBarLabel: 'Nueva', tabBarIcon: ({ color }) => <IconPlus size={20} color={color} />, headerShown: true, headerTitle: 'Nueva solicitud' }} component={CreateTicketScreen} />
      <Tab.Screen name="JefePerfilTab" options={{ ...screenOpts, tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <IconUser size={16} color={color} />, headerShown: true, headerTitle: 'Mi perfil' }} component={PerfilScreen} />
    </Tab.Navigator>
  );
}
