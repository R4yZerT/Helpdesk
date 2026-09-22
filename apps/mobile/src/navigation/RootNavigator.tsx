// Navegacion raiz — gatea por sesion y rol (RF-04/05) (Atributos: Seguridad + Usabilidad)
// Admin (RF-27/28/29/30/31/32), Jefe Dashboard+Alertas IA (RF-16/17/18/24), campana RF-23 en headers.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { UpdatePasswordScreen } from '../features/auth/UpdatePasswordScreen';
import { ChangePasswordScreen } from '../features/auth/ChangePasswordScreen';
import { theme, ErrorBoundary, useOnboarding, OnboardingCard, useTheme, type RolOnboarding } from '@helpdesk/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mobileStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};
import { UsuarioNavigator } from '../features/usuario/UsuarioNavigator';
import { AdminNavigator } from '../features/admin/AdminNavigator';
import { JefeNavigator } from '../features/jefe/JefeNavigator';
import { HeaderBell } from '../components/HeaderBell';
import { usePushNotificaciones } from '../hooks/usePushNotificaciones';
import { navigationRef } from './navigationRef';
import type { AuthStackParamList } from './types';
import { TecnicoNavigator } from './TecnicoNavigator';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  headerRight: () => <HeaderBell />,
  contentStyle: { backgroundColor: theme.colors.bg },
};

function AuthNavigator() {
  // RF-03 recovery: si hay tokens pendientes, entrar directo a Nueva contraseña
  const { recoveryPending } = useAuth();
  return (
    <AuthStack.Navigator screenOptions={screenOpts} initialRouteName={recoveryPending ? 'UpdatePassword' : 'Login'}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
      <AuthStack.Screen name="UpdatePassword" component={UpdatePasswordScreen} options={{ title: 'Nueva contraseña' }} />
      <AuthStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Cambiar contraseña' }} />
    </AuthStack.Navigator>
  );
}
function EmpleadoNavigator() {
  return <UsuarioNavigator />;
}
// RF-05 fail-closed (Fase 3 A3): rol desconocido/corrupto NUNCA cae a Admin.
function RolDesconocido() {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.colors.bg }}>
      <Text style={{ fontWeight: '700', color: theme.colors.text }}>Rol no reconocido</Text>
      <Text style={{ opacity: 0.6, marginTop: 8, textAlign: 'center', color: theme.colors.text }}>
        Tu cuenta tiene un rol inválido. Contacta al administrador.
      </Text>
      <Pressable onPress={signOut} style={{ marginTop: 16, padding: 10 }}>
        <Text style={{ textDecorationLine: 'underline', color: theme.colors.primary }}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}
export function RootNavigator() {
  const { session, profile, loading, idleWarning, resetIdle, error, recoveryPending } = useAuth();
  // RF-23: suscripción realtime + refresh al volver a primer plano (no-op sin sesión)
  usePushNotificaciones();
  // H12 — guía de primer uso por rol (una vez por versión)
  const ob = useOnboarding(session && profile ? mobileStorage : null, (profile?.rol as RolOnboarding | undefined) ?? null);
  // H13 — chrome de navegación reactivo al esquema (resto de pantallas: seguimiento)
  const { theme: t } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: t.colors.bg, card: t.colors.surface, text: t.colors.text, border: t.colors.border, primary: t.colors.primary },
  };
  if (loading) {
    return (
      <View style={s.loading}>
        <View style={s.loadingDot} />
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={s.loadingText}>Cargando sesión…</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }} onTouchStart={resetIdle}>
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
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
        // El SO abre la app con helpdesk://ticket/<id>; el ruteo lo resuelve
        // la cola pendiente (árbol por rol) en usePushNotificaciones.
        linking={{ prefixes: ['helpdesk://'] }}
      >
        <ErrorBoundary titulo="La navegación no pudo cargarse">
          {!session || !profile || recoveryPending ? <AuthNavigator /> : profile.rol === 'usuario' ? <EmpleadoNavigator /> : profile.rol === 'tecnico' ? <TecnicoNavigator /> : profile.rol === 'jefe' ? <JefeNavigator /> : profile.rol === 'administrador' ? <AdminNavigator /> : <RolDesconocido />}
        </ErrorBoundary>
      </NavigationContainer>
      {ob.visible ? <OnboardingCard pasos={ob.pasos} paso={ob.paso} onSiguiente={ob.siguiente} onOmitir={ob.cerrar} /> : null}
    </View>
  );
}
const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.bg, padding: 24 },
  loadingDot: { width: 36, height: 3, borderRadius: 999, backgroundColor: theme.colors.accent },
  loadingText: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  idleBar: { backgroundColor: '#8A6A2E', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  idleText: { color: '#FFF8E6', fontWeight: '700', fontSize: 11, flex: 1 },
  idleLink: { color: '#fff', textDecorationLine: 'underline', fontSize: 11, fontWeight: '700' },
  errorBar: { backgroundColor: '#7F1D1D', paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center' },
  errorText: { color: '#FFE4E6', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
