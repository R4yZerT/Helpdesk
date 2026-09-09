// Navegacion raiz — gatea por sesion y rol (RF-05)
// Usa @react-navigation/native-stack; cada rol tiene su stack.

import { ActivityIndicator, Button, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { UpdatePasswordScreen } from '../features/auth/UpdatePasswordScreen';
import { ChangePasswordScreen } from '../features/auth/ChangePasswordScreen';
import { CreateTicketScreen } from '../features/tickets/CreateTicketScreen';
import { PerfilScreen } from '../features/perfil/PerfilScreen';
import { TecnicoNavigator } from '../features/tecnico/TecnicoNavigator';
import { JefeNavigator } from '../features/jefe/JefeNavigator';
import { UsuarioNavigator } from '../features/usuario/UsuarioNavigator';
import { AdminNavigator } from '../features/admin/AdminNavigator';
import type { AuthStackParamList } from './types';

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
const RootStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Recuperar contraseña', headerShown: false }} />
      <AuthStack.Screen name="UpdatePassword" component={UpdatePasswordScreen} options={{ title: 'Nueva contraseña', headerShown: false }} />
    </AuthStack.Navigator>
  );
}

function RoleNavigator() {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.rol === 'usuario') return <UsuarioNavigator />;
  if (profile.rol === 'tecnico') return <TecnicoNavigator />;
  if (profile.rol === 'jefe') return <JefeNavigator />;
  return <AdminNavigator />;
}

function EmpleadoNavigator() {
  return <UsuarioNavigator />;
}



/* JefeNavigator movido a features/jefe/JefeNavigator.tsx con AppShell sidebar+reloj 56px */



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
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session || !profile ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <RootStack.Screen name="App" component={RoleNavigator} />
            <RootStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerShown: true, title: 'Cambiar contraseña', presentation: 'modal' }} />
            <RootStack.Screen name="Perfil" component={PerfilScreen} options={{ headerShown: true, title: 'Mi perfil', presentation: 'modal' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
