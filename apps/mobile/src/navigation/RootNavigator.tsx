// Navegacion raiz — gatea por sesion y rol (RF-04/05) (Atributos: Seguridad + Usabilidad)
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { ChangePasswordScreen } from '../features/auth/ChangePasswordScreen';
import { CreateTicketScreen } from '../features/tickets/CreateTicketScreen';
import { MisSolicitudesScreen } from '../features/tickets/MisSolicitudesScreen';
import { TicketDetailScreen } from '../features/tickets/TicketDetailScreen';
import { Card, theme } from '@helpdesk/shared';
import type { AdminStackParamList, AuthStackParamList, EmpleadoStackParamList, UsuarioStackParamList, JefeStackParamList, TecnicoStackParamList } from './types';

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: theme.colors.bg, card: theme.colors.surface, text: theme.colors.text, border: theme.colors.border, primary: theme.colors.primary },
};

function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  const { profile, signOut } = useAuth();
  return (
    <View style={p.wrap}>
      <Card>
        <View style={p.cardHead}><View style={p.hairline} /><Text style={p.kicker}>Módulo</Text></View>
        <Text style={p.title}>{title}</Text>
        {subtitle ? <Text style={p.subtitle}>{subtitle}</Text> : null}
        {profile ? <Text style={p.meta}>Rol {profile.rol} · {profile.email}</Text> : null}
        <Pressable onPress={signOut} style={p.btn}><Text style={p.btnText}>Cerrar sesión</Text></Pressable>
      </Card>
      <Text style={p.hint}>Diseño en progreso — la lógica y RLS ya están detrás.</Text>
    </View>
  );
}
const p = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, backgroundColor: theme.colors.bg, justifyContent: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hairline: { width: 18, height: 2, borderRadius: 999, backgroundColor: theme.colors.accent },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: theme.colors.muted, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, color: theme.colors.muted, lineHeight: 16, marginTop: 6 },
  meta: { fontSize: 11, color: theme.colors.mutedSoft, marginTop: 10 },
  btn: { marginTop: 14, backgroundColor: theme.colors.primary, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  hint: { fontSize: 11, color: theme.colors.mutedSoft, textAlign: 'center', marginTop: 4 },
});

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const UsuarioStack = createNativeStackNavigator<UsuarioStackParamList>();
const EmpleadoStack = UsuarioStack;
const TecnicoStack = createNativeStackNavigator<TecnicoStackParamList>();
const JefeStack = createNativeStackNavigator<JefeStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
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
function UsuarioNavigator() {
  return (
    <UsuarioStack.Navigator screenOptions={screenOpts}>
      <UsuarioStack.Screen name="MisSolicitudes" options={{ title: 'Mis solicitudes' }} component={MisSolicitudesScreen} />
      <UsuarioStack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CreateTicketScreen} />
      <UsuarioStack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={TicketDetailScreen} />
    </UsuarioStack.Navigator>
  );
}
function EmpleadoNavigator() {
  return <UsuarioNavigator />;
}
function TecnicoNavigator() {
  return (
    <TecnicoStack.Navigator screenOptions={screenOpts}>
      <TecnicoStack.Screen name="Bandeja" options={{ title: 'Bandeja' }}>{() => <Placeholder title="Bandeja técnico" subtitle="RF-12 orden por prioridad y antigüedad · RF-13 transiciones de estado" />}</TecnicoStack.Screen>
      <TecnicoStack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CreateTicketScreen} />
      <TecnicoStack.Screen name="DetalleTicket" options={{ title: 'Detalle' }}>{() => <Placeholder title="Detalle técnico" subtitle="RF-13 transiciones · RF-15 hilo de avances" />}</TecnicoStack.Screen>
    </TecnicoStack.Navigator>
  );
}
function JefeNavigator() {
  return (
    <JefeStack.Navigator screenOptions={screenOpts}>
      <JefeStack.Screen name="Dashboard" options={{ title: 'Dashboard' }}>{() => <Placeholder title="Dashboard" subtitle="RF-16 tiempo real · RF-17 filtros · RF-21 alertas IA" />}</JefeStack.Screen>
      <JefeStack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CreateTicketScreen} />
      <JefeStack.Screen name="Reportes" options={{ title: 'Reportes' }}>{() => <Placeholder title="Reportes" subtitle="RF-18 exportación PDF / CSV" />}</JefeStack.Screen>
      <JefeStack.Screen name="Alertas" options={{ title: 'Alertas IA' }}>{() => <Placeholder title="Alertas IA" subtitle="RF-24 anomalías y picos inusuales" />}</JefeStack.Screen>
    </JefeStack.Navigator>
  );
}
function AdminNavigator() {
  return (
    <AdminStack.Navigator screenOptions={screenOpts}>
      <AdminStack.Screen name="Usuarios" options={{ title: 'Usuarios' }}>{() => <Placeholder title="Usuarios" subtitle="RF-27 / RF-28  ·  crear, editar, desactivar, asignar rol y mesa" />}</AdminStack.Screen>
      <AdminStack.Screen name="Mesas" options={{ title: 'Mesas' }}>{() => <Placeholder title="Mesas" subtitle="RF-29 / RF-31  ·  catálogo y respaldo" />}</AdminStack.Screen>
      <AdminStack.Screen name="Categorias" options={{ title: 'Categorías' }}>{() => <Placeholder title="Categorías" subtitle="RF-32  ·  catálogo normalizado (19 categorías)" />}</AdminStack.Screen>
      <AdminStack.Screen name="Import" options={{ title: 'Import' }}>{() => <Placeholder title="Import histórico" subtitle="RF-26  ·  latin-1 → UTF-8 NFD con cuarentena" />}</AdminStack.Screen>
    </AdminStack.Navigator>
  );
}

export function RootNavigator() {
  const { session, profile, loading, idleWarning, resetIdle, error } = useAuth();
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
      <NavigationContainer theme={navTheme}>
        {!session || !profile ? <AuthNavigator /> : profile.rol === 'usuario' ? <UsuarioNavigator /> : profile.rol === 'tecnico' ? <TecnicoNavigator /> : profile.rol === 'jefe' ? <JefeNavigator /> : <AdminNavigator />}
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
