// Navegacion raiz — gatea por sesion y rol (RF-05)
// Usa @react-navigation/native-stack; cada rol tiene su stack.

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  if (profile.rol === 'usuario') return <UsuarioNavigator />;
  if (profile.rol === 'tecnico') return <TecnicoNavigator />;
  if (profile.rol === 'jefe') return <JefeNavigator />;
  if (profile.rol === 'administrador') return <AdminNavigator />;
  // RF-05 fail-closed (Fase 3 A3): rol desconocido/corrupto NUNCA cae a Admin.
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontWeight: '700' }}>Rol no reconocido</Text>
      <Text style={{ opacity: 0.6, marginTop: 8, textAlign: 'center' }}>
        Tu cuenta tiene un rol inválido. Contacta al administrador.
      </Text>
      <Pressable onPress={signOut} style={{ marginTop: 16, padding: 10 }}>
        <Text style={{ textDecorationLine: 'underline' }}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

export function RootNavigator() {
  const { session, profile, loading, idleWarning, resetIdle, error } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, opacity: 0.6 }}>Cargando sesión…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onTouchStart={resetIdle}>
      {idleWarning ? (
        <View style={s.idleBar}>
          <Text style={s.idleText}>{idleWarning}</Text>
          <Pressable onPress={resetIdle}><Text style={s.idleLink}>Seguir activo</Text></Pressable>
        </View>
      ) : null}
      {error ? (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
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
    </View>
  );
}

const s = StyleSheet.create({
  idleBar: { backgroundColor: '#8A6A2E', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  idleText: { color: '#FFF8E6', fontWeight: '700', fontSize: 11, flex: 1 },
  idleLink: { color: '#fff', textDecorationLine: 'underline', fontSize: 11, fontWeight: '700' },
  errorBar: { backgroundColor: '#7F1D1D', paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center' },
  errorText: { color: '#FFE4E6', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
