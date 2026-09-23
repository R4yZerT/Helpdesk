// AdminNavigator móvil — Tabs: Admin (Usuarios/Dependencias/Categorías) · Mesas (tickets dependencia) · Perfil
// Paridad con apps/web AdminNavigator; en móvil se usa tab bar nativa + campana RF-23.
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, IconGrid, IconSettings, IconUser, withScreenBoundary } from '@helpdesk/shared';
import { AdminUsuariosScreen } from './AdminUsuariosScreen';
import { AdminMesaTicketsScreen } from './AdminMesaTicketsScreen';
import { AdminMesasScreen } from './AdminMesasScreen';
import { AdminCategoriasScreen } from './AdminCategoriasScreen';
import { DetalleTecnicoScreen } from '../tecnico/DetalleTecnicoScreen';
import { PerfilScreen } from '../perfil/PerfilScreen';
import { reportError } from '../../lib/sentry';
import { HeaderBell } from '../../components/HeaderBell';
import { RequirePermission } from '../../components/RequirePermission';
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

// H6 — cada pantalla aislada: si una rompe, el resto del navigator sigue vivo
const UsuariosAislada = withScreenBoundary(AdminUsuariosScreen, { titulo: 'Los usuarios no pudieron cargarse', onError: (e) => reportError(e, { flujo: 'admin-usuarios' }) });
const MesaTicketsAislada = withScreenBoundary(AdminMesaTicketsScreen, { titulo: 'Los tickets no pudieron cargarse', onError: (e) => reportError(e, { flujo: 'admin-mesa-tickets' }) });
const MesasAislada = withScreenBoundary(AdminMesasScreen, { titulo: 'Las dependencias no pudieron cargarse', onError: (e) => reportError(e, { flujo: 'admin-mesas' }) });
const CategoriasAislada = withScreenBoundary(AdminCategoriasScreen, { titulo: 'Las categorías no pudieron cargarse', onError: (e) => reportError(e, { flujo: 'admin-categorias' }) });
const DetalleAislado = withScreenBoundary(DetalleTecnicoScreen, { titulo: 'El detalle no pudo cargarse', onError: (e) => reportError(e, { flujo: 'admin-detalle' }) });
const PerfilAislado = withScreenBoundary(PerfilScreen, { titulo: 'El perfil no pudo cargarse', onError: (e) => reportError(e, { flujo: 'admin-perfil' }) });

function AdminMainStack() {
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Usuarios" options={{ title: 'Usuarios' }} component={UsuariosAislada} />
      <Stack.Screen name="MesaTickets" options={{ title: 'Tickets de mi dependencia' }} component={MesaTicketsAislada} />
      <Stack.Screen name="Mesas" options={{ title: 'Dependencias' }} component={MesasAislada} />
      <Stack.Screen name="Categorias" options={{ title: 'Categorías' }} component={CategoriasAislada} />
      <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleAislado} />
    </Stack.Navigator>
  );
}

export function AdminNavigator() {
  // RF-05 (Fase 3 A3): guard por permiso aunque el router ya filtre por rol —
  // profile:manage solo lo tiene administrador (defensa en profundidad).
  return (
    <RequirePermission permission="profile:manage">
      <Tab.Navigator screenOptions={tabOpts}>
        <Tab.Screen name="AdminMainTab" options={{ tabBarLabel: 'Admin', tabBarIcon: ({ color }) => <IconSettings size={16} color={color} /> }} component={AdminMainStack} />
        <Tab.Screen name="AdminMesasTab" options={{ tabBarLabel: 'Mesas', tabBarIcon: ({ color }) => <IconGrid size={16} color={color} />, headerShown: true, headerTitle: 'Tickets de mi dependencia', headerRight: () => <HeaderBell /> }} component={MesaTicketsAislada} />
        <Tab.Screen name="AdminPerfilTab" options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <IconUser size={16} color={color} />, headerShown: true, headerTitle: 'Mi perfil' }} component={PerfilAislado} />
      </Tab.Navigator>
    </RequirePermission>
  );
}
