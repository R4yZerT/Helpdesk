// Navegacion raiz — gatea por sesion y rol (RF-05)
// Usa @react-navigation/native-stack; cada rol tiene su stack.

import { ActivityIndicator, Button, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../features/auth/LoginScreen';
import { CreateTicketScreen } from '../features/tickets/CreateTicketScreen';
import { TecnicoNavigator } from '../features/tecnico/TecnicoNavigator';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { UsuarioNavigator } from '../features/usuario/UsuarioNavigator';
import { AdminNavigator } from '../features/admin/AdminNavigator';
import type { AuthStackParamList, JefeStackParamList } from './types';

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
const JefeStack = createNativeStackNavigator<JefeStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    </AuthStack.Navigator>
  );
}

function EmpleadoNavigator() {
  return <UsuarioNavigator />;
}



function JefeNavigator() {
  return (
    <JefeStack.Navigator screenOptions={{ headerShown: false }}>
      <JefeStack.Screen name="Dashboard" component={DashboardScreen} />
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
      ) : profile.rol === 'usuario' ? (
        <UsuarioNavigator />
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
