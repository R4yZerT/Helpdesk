// AdminNavigator — web AppShell + sidebar global + footer legal (Stitch) — RF-27
import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, Sidebar, AppFooter } from '@helpdesk/shared';
import { AdminUsuariosScreen } from './AdminUsuariosScreen';
import { AdminMesasScreen } from './AdminMesasScreen';
import type { AdminStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

const Stack = createNativeStackNavigator<AdminStackParamList>();

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

function AdminWeb() {
  const [activeName, setActiveName] = React.useState('Usuarios');
  const { profile, signOut } = useAuth();
  return <AdminWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}

function AdminWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: { full_name?: string | null; email?: string | null; rol: string } | null; signOut: () => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<AdminStackParamList> | null>(null);

  const isActive = (id: string) => {
    if (id === 'usuarios') return activeName === 'Usuarios';
    if (id === 'mesas') return activeName === 'Mesas';
    if (id === 'categorias') return activeName === 'Categorias';
    if (id === 'import') return activeName === 'Import';
    return false;
  };
  const navigateAndClose = (name: string) => {
    nav?.navigate(name as never);
    setDrawerOpen(false);
  };
  const sidebarContent = (
    <Sidebar
      items={[
        { id: 'usuarios', label: 'Usuarios (RF-27)', active: isActive('usuarios'), onPress: () => navigateAndClose('Usuarios') },
        { id: 'mesas', label: 'Mesas (RF-29)', active: isActive('mesas'), onPress: () => navigateAndClose('Mesas') },
        { id: 'categorias', label: 'Categorías (RF-32)', active: isActive('categorias'), onPress: () => navigateAndClose('Categorias') },
        { id: 'import', label: 'Import (RF-26)', active: isActive('import'), onPress: () => navigateAndClose('Import') },
      ]}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Administrador') as string, role: profile.rol } : undefined}
      onLogout={signOut}
    />
  );

  React.useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);
  React.useEffect(() => { setDrawerOpen(false); }, [activeName]);

  if (isDesktop) {
    return (
      <View style={w.root}>
        <View style={w.sidebar}>{sidebarContent}</View>
        <View style={w.main}>
          <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={screenOpts}>
              <Stack.Screen name="Usuarios" component={AdminUsuariosScreen} options={{ title: 'Usuarios — RF-27' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Usuarios'); } })} />
              <Stack.Screen name="Mesas" component={AdminMesasScreen} options={{ title: 'Mesas — RF-29' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Mesas'); } })} />
              <Stack.Screen name="Categorias" options={{ title: 'Categorías — RF-32' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Categorias'); } })}>{() => <View style={w.placeholder}><Text style={w.placeholderText}>Categorías RF-32 pendiente</Text></View>}</Stack.Screen>
              <Stack.Screen name="Import" options={{ title: 'Import — RF-26' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Import'); } })}>{() => <View style={w.placeholder}><Text style={w.placeholderText}>Import RF-26 pendiente</Text></View>}</Stack.Screen>
            </Stack.Navigator>
          </View>
          <AppFooter />
        </View>
      </View>
    );
  }

  const mobileTitle = activeName === 'Mesas' ? 'Mesas' : activeName === 'Categorias' ? 'Categorías' : activeName === 'Import' ? 'Import' : 'Usuarios';
  return (
    <View style={w.rootMobile}>
      <View style={w.mobileTopBar}>
        <Pressable onPress={() => setDrawerOpen((v) => !v)} style={w.burger} accessibilityRole="button" accessibilityLabel="Abrir menú">
          <Text style={w.burgerText}>☰</Text>
        </Pressable>
        <Text style={w.mobileTitle}>{mobileTitle}</Text>
        <View style={w.burgerSpacer} />
      </View>
      <View style={w.mainMobile}>
        <View style={{ flex: 1 }}>
          <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }}>
            <Stack.Screen name="Usuarios" component={AdminUsuariosScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Usuarios'); } })} />
            <Stack.Screen name="Mesas" component={AdminMesasScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Mesas'); } })} />
            <Stack.Screen name="Categorias" listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Categorias'); } })}>{() => <View style={w.placeholder}><Text style={w.placeholderText}>Categorías RF-32 pendiente</Text></View>}</Stack.Screen>
            <Stack.Screen name="Import" listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Import'); } })}>{() => <View style={w.placeholder}><Text style={w.placeholderText}>Import RF-26 pendiente</Text></View>}</Stack.Screen>
          </Stack.Navigator>
        </View>
        <AppFooter />
        {drawerOpen ? (
          <Pressable style={w.overlay} onPress={() => setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar menú">
            <View style={w.drawer}>{sidebarContent}</View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const w = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: theme.colors.bg },
  rootMobile: { flex: 1, flexDirection: 'column', backgroundColor: theme.colors.bg },
  sidebar: { width: 256, backgroundColor: theme.colors.surface, borderRightWidth: 1, borderRightColor: theme.colors.border, padding: 16 },
  main: { flex: 1, minWidth: 0 as unknown as number, flexDirection: 'column' as const },
  mainMobile: { flex: 1, minWidth: 0 as unknown as number, position: 'relative', flexDirection: 'column' as const },
  mobileTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: 8, height: 56 },
  burger: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  burgerText: { fontSize: 18, color: theme.colors.text },
  burgerSpacer: { width: 44 },
  mobileTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 50, flexDirection: 'row' },
  drawer: { width: 256, backgroundColor: theme.colors.surface, padding: 16, borderRightWidth: 1, borderRightColor: theme.colors.border, height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: theme.colors.muted },
});

export function AdminNavigator() {
  if (Platform.OS === 'web') return <AdminWeb />;
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Usuarios" component={AdminUsuariosScreen} options={{ title: 'Usuarios — RF-27' }} />
    </Stack.Navigator>
  );
}
