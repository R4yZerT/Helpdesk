// Navegacion raiz — gatea por sesion y rol (RF-05)
// Usa @react-navigation/native-stack; cada rol tiene su stack.

import { ActivityIndicator, Button, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../features/auth/LoginScreen';
import { CreateTicketScreen } from '../features/tickets/CreateTicketScreen';
import type {
  AdminStackParamList,
  AuthStackParamList,
  EmpleadoStackParamList,
  JefeStackParamList,
  TecnicoStackParamList,
} from './types';

function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  const { profile, signOut } = useAuth();
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>{title}</Text>
      {subtitle ? <Text style={{ opacity: 0.6, textAlign: 'center' }}>{subtitle}</Text> : null}
      {profile ? <Text style={{ fontSize: 11, opacity: 0.5 }}>Rol: {profile.rol} · {profile.email}</Text> : null}
      <Button title="Cerrar sesión" onPress={signOut} />
    </View>
  );
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const EmpleadoStack = createNativeStackNavigator<EmpleadoStackParamList>();
const TecnicoStack = createNativeStackNavigator<TecnicoStackParamList>();
const JefeStack = createNativeStackNavigator<JefeStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    </AuthStack.Navigator>
  );
}

function EmpleadoNavigator() {
  return (
    <EmpleadoStack.Navigator>
      <EmpleadoStack.Screen name="MisSolicitudes" options={{ title: 'Mis solicitudes (RF-08)' }}>
        {() => <Placeholder title="Mis solicitudes" subtitle="RF-08 listado con filtros y búsqueda" />}
      </EmpleadoStack.Screen>
      <EmpleadoStack.Screen name="CrearTicket" options={{ title: 'Crear solicitud (RF-06)' }} component={CreateTicketScreen} />
      <EmpleadoStack.Screen name="DetalleTicket" options={{ title: 'Detalle (RF-09)' }}>
        {() => <Placeholder title="Detalle" subtitle="RF-09 historial + comentarios" />}
      </EmpleadoStack.Screen>
    </EmpleadoStack.Navigator>
  );
}

function TecnicoNavigator() {
  return (
    <TecnicoStack.Navigator>
      <TecnicoStack.Screen name="Bandeja" options={{ title: 'Bandeja (RF-12)' }}>
        {() => <Placeholder title="Bandeja técnico" subtitle="RF-12 orden por prioridad/antigüedad · RF-13 estados" />}
      </TecnicoStack.Screen>
      <TecnicoStack.Screen name="CrearTicket" options={{ title: 'Crear solicitud (RF-06)' }} component={CreateTicketScreen} />
      <TecnicoStack.Screen name="DetalleTicket" options={{ title: 'Ticket' }}>
        {() => <Placeholder title="Detalle técnico" subtitle="RF-13 transiciones · RF-15 comentarios" />}
      </TecnicoStack.Screen>
    </TecnicoStack.Navigator>
  );
}

function JefeNavigator() {
  return (
    <JefeStack.Navigator>
      <JefeStack.Screen name="Dashboard" options={{ title: 'Dashboard (RF-16)' }}>
        {() => <Placeholder title="Dashboard jefe" subtitle="RF-16 tiempo real · RF-17 filtros · RF-21 alertas IA" />}
      </JefeStack.Screen>
      <JefeStack.Screen name="CrearTicket" options={{ title: 'Crear solicitud (RF-06)' }} component={CreateTicketScreen} />
      <JefeStack.Screen name="Reportes" options={{ title: 'Reportes (RF-18)' }}>
        {() => <Placeholder title="Reportes" subtitle="RF-18 exportación PDF/CSV" />}
      </JefeStack.Screen>
      <JefeStack.Screen name="Alertas" options={{ title: 'Alertas IA (RF-24)' }}>
        {() => <Placeholder title="Alertas IA" subtitle="RF-24 anomalías y picos" />}
      </JefeStack.Screen>
    </JefeStack.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator>
      <AdminStack.Screen name="Usuarios" options={{ title: 'Usuarios (RF-27)' }}>
        {() => <Placeholder title="Usuarios" subtitle="RF-27/28 crear, editar, desactivar, asignar rol+mesa" />}
      </AdminStack.Screen>
      <AdminStack.Screen name="Mesas" options={{ title: 'Mesas (RF-29)' }}>
        {() => <Placeholder title="Mesas" subtitle="RF-29/31 mesas y respaldo" />}
      </AdminStack.Screen>
      <AdminStack.Screen name="Categorias" options={{ title: 'Categorías (RF-32)' }}>
        {() => <Placeholder title="Categorías" subtitle="RF-32 catálogo normalizado (19)" />}
      </AdminStack.Screen>
      <AdminStack.Screen name="Import" options={{ title: 'Import (RF-26)' }}>
        {() => <Placeholder title="Import histórico" subtitle="RF-26 latin-1 → UTF-8 NFD" />}
      </AdminStack.Screen>
    </AdminStack.Navigator>
  );
}

export function RootNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, opacity: 0.6 }}>Cargando sesión…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!session || !profile ? (
        <AuthNavigator />
      ) : profile.rol === 'empleado' ? (
        <EmpleadoNavigator />
      ) : profile.rol === 'tecnico' ? (
        <TecnicoNavigator />
      ) : profile.rol === 'jefe' ? (
        <JefeNavigator />
      ) : (
        <AdminNavigator />
      )}
    </NavigationContainer>
  );
}
