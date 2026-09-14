// Navegacion raiz — gatea por sesion y rol (RF-04/05) (Atributos: Seguridad + Usabilidad)
// Admin (RF-27/28/29/30/31/32), Jefe Dashboard+Alertas IA (RF-16/17/18/24), campana RF-23 en headers.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { ChangePasswordScreen } from '../features/auth/ChangePasswordScreen';
import { CreateTicketScreen } from '../features/tickets/CreateTicketScreen';
import { BandejaTecnicoScreen } from '../features/tecnico/BandejaTecnicoScreen';
import { DetalleTecnicoScreen } from '../features/tecnico/DetalleTecnicoScreen';
import { theme } from '@helpdesk/shared';
import { PerfilScreen } from '../features/perfil/PerfilScreen';
import { UsuarioNavigator } from '../features/usuario/UsuarioNavigator';
import { AdminNavigator } from '../features/admin/AdminNavigator';
import { JefeNavigator } from '../features/jefe/JefeNavigator';
import { HeaderBell } from '../components/HeaderBell';
import { usePushNotificaciones } from '../hooks/usePushNotificaciones';
import { navigationRef } from './navigationRef';
import type { AuthStackParamList, TecnicoStackParamList } from './types';

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: theme.colors.bg, card: theme.colors.surface, text: theme.colors.text, border: theme.colors.border, primary: theme.colors.primary },
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const TecnicoStack = createNativeStackNavigator<TecnicoStackParamList>();
const Tab = createBottomTabNavigator();

const tabOpts = {
  headerShown: false as const,
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: theme.colors.muted,
  tabBarStyle: { height: 62, paddingTop: 6, paddingBottom: 8, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
};

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  headerRight: () => <HeaderBell />,
  contentStyle: { backgroundColor: theme.colors.bg },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={screenOpts}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
      <AuthStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Cambiar contraseña' }} />
    </AuthStack.Navigator>
  );
}
function EmpleadoNavigator() {
  return <UsuarioNavigator />;
}
function TecnicoBandejaStack() {
  return (
    <TecnicoStack.Navigator screenOptions={screenOpts}>
      <TecnicoStack.Screen name="Bandeja" options={{ title: 'Bandeja' }} component={BandejaTecnicoScreen} />
      <TecnicoStack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CreateTicketScreen} />
      <TecnicoStack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleTecnicoScreen} />
    </TecnicoStack.Navigator>
  );
}
function TecnicoNavigator() {
  return (
    <Tab.Navigator screenOptions={tabOpts}>
      <Tab.Screen name="TecnicoBandejaTab" options={{ tabBarLabel: 'Bandeja', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☰</Text> }} component={TecnicoBandejaStack} />
      <Tab.Screen name="TecnicoCrearTab" options={{ tabBarLabel: 'Nueva', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>＋</Text>, headerShown: true, headerStyle: { backgroundColor: theme.colors.surface } as never, headerTintColor: theme.colors.primary, headerRight: () => <HeaderBell /> }} component={CreateTicketScreen} />
      <Tab.Screen name="TecnicoPerfilTab" options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>◉</Text>, headerShown: true, headerTitle: 'Mi perfil', headerRight: () => <HeaderBell /> }} component={PerfilScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { session, profile, loading, idleWarning, resetIdle, error } = useAuth();
  // RF-23: suscripción realtime + refresh al volver a primer plano (no-op sin sesión)
  usePushNotificaciones();
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
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }} onTouchStart={resetIdle}>
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
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        {!session || !profile ? <AuthNavigator /> : profile.rol === 'usuario' ? <EmpleadoNavigator /> : profile.rol === 'tecnico' ? <TecnicoNavigator /> : profile.rol === 'jefe' ? <JefeNavigator /> : <AdminNavigator />}
      </NavigationContainer>
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
