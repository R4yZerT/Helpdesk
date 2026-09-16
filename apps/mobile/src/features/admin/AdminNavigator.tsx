// AdminNavigator móvil — Tabs: Admin (Usuarios/Dependencias/Categorías) · Mesas (tickets dependencia) · Perfil
// Paridad con apps/web AdminNavigator; en móvil se usa tab bar nativa + campana RF-23.
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '@helpdesk/shared';
import { AdminUsuariosScreen } from './AdminUsuariosScreen';
import { AdminMesaTicketsScreen } from './AdminMesaTicketsScreen';
import { AdminMesasScreen } from './AdminMesasScreen';
import { AdminCategoriasScreen } from './AdminCategoriasScreen';
import { DetalleTecnicoScreen } from '../tecnico/DetalleTecnicoScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import { HeaderBell } from '../../components/HeaderBell';
import type { AdminStackParamList } from '../../navigation/types';

const Stack = createNativeStackNavigator<AdminStackParamList>();
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

function AdminMainStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Usuarios" options={{ title: 'Usuarios' }} component={AdminUsuariosScreen} />
      <Stack.Screen name="MesaTickets" options={{ title: 'Tickets de mi dependencia' }} component={AdminMesaTicketsScreen} />
      <Stack.Screen name="Mesas" options={{ title: 'Dependencias' }} component={AdminMesasScreen} />
      <Stack.Screen name="Categorias" options={{ title: 'Categorías' }} component={AdminCategoriasScreen} />
      <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleTecnicoScreen} />
    </Stack.Navigator>
  );
}

export function AdminNavigator() {
  return (
    <Tab.Navigator screenOptions={tabOpts}>
      <Tab.Screen name="AdminMainTab" options={{ tabBarLabel: 'Admin', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>⚙</Text> }} component={AdminMainStack} />
      <Tab.Screen name="AdminMesasTab" options={{ tabBarLabel: 'Mesas', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>▦</Text>, headerShown: true, headerTitle: 'Tickets de mi dependencia', headerRight: () => <HeaderBell /> }} component={AdminMesaTicketsScreen} />
      <Tab.Screen name="AdminPerfilTab" options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>◉</Text>, headerShown: true, headerTitle: 'Mi perfil' }} component={PerfilScreen} />
    </Tab.Navigator>
  );
}
