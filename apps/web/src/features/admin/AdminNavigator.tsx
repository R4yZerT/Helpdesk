// AdminNavigator — web AppShell + sidebar global + footer legal (Stitch)
import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, Sidebar, IconUsers, IconLayers, IconTable, IconTag, IconUpload, Clock } from '@helpdesk/shared';
import { AdminUsuariosScreen } from './AdminUsuariosScreen';
import { AdminMesasScreen } from './AdminMesasScreen';
import { AdminMesaTicketsScreen } from './AdminMesaTicketsScreen';
import { AdminCategoriasScreen } from './AdminCategoriasScreen';
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
  const [activeName, setActiveName] = React.useState('MesaTickets');
  const { profile, signOut } = useAuth();
  return <AdminWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}

function AdminWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: { full_name?: string | null; email?: string | null; rol: string } | null; signOut: () => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<AdminStackParamList> | null>(null);

  const mesaId = (profile as unknown as { mesa_id?: number | null })?.mesa_id ?? (profile as unknown as { mesaId?: number | null })?.mesaId ?? null;
  const isGeneralAdmin = mesaId == null;
  const isActive = (id: string) => {
    if (id === 'usuarios') return activeName === 'Usuarios';
    if (id === 'mesas') return activeName === 'Mesas';
    if (id === 'mesaTickets') return activeName === 'MesaTickets';
    if (id === 'categorias') return activeName === 'Categorias';
    if (id === 'import') return activeName === 'Import';
    return false;
  };
  // Fix pantalla blanca: evita navegar duplicado; si el destino ya está en el stack hace pop/navigate limpio
  const navigateAndClose = (name: string) => {
    if (activeName === name) { setDrawerOpen(false); return; }
    // Para Admin todas las pantallas son hermanas en el mismo Stack: navigate normal basta, pero evitamos doble push si ya existe
    try {
      const anyNav = nav as unknown as { getState?: () => { routes: { name: string }[] }; popToTop?: () => void };
      const st = anyNav?.getState?.();
      const hasTarget = st?.routes?.some((r) => r.name === name);
      if (hasTarget) {
        // Si ya existe, navigate hará pop al existente sin dejar pantalla blanca
        nav?.navigate(name as never);
        setDrawerOpen(false);
        return;
      }
    } catch {}
    nav?.navigate(name as never);
    setDrawerOpen(false);
  };
  const ic = (active: boolean) => (active ? theme.colors.primaryDark : theme.colors.muted);
  const allItems = [
        { id: 'mesaTickets', label: 'MESAS', active: isActive('mesaTickets'), onPress: () => navigateAndClose('MesaTickets'), icon: <IconTable size={14} color={ic(isActive('mesaTickets'))} /> },
        ...(isGeneralAdmin ? [{ id: 'mesas', label: 'DEPENDENCIAS', active: isActive('mesas'), onPress: () => navigateAndClose('Mesas'), icon: <IconLayers size={14} color={ic(isActive('mesas'))} /> } as const] : []),
        { id: 'usuarios', label: 'USUARIOS', active: isActive('usuarios'), onPress: () => navigateAndClose('Usuarios'), icon: <IconUsers size={14} color={ic(isActive('usuarios'))} /> },
        { id: 'categorias', label: 'CATEGORÍAS', active: isActive('categorias'), onPress: () => navigateAndClose('Categorias'), icon: <IconTag size={14} color={ic(isActive('categorias'))} /> },
        { id: 'import', label: 'IMPORT', active: isActive('import'), onPress: () => navigateAndClose('Import'), icon: <IconUpload size={14} color={ic(isActive('import'))} /> },
      ];
  const sidebarContent = (
    <Sidebar
      items={allItems as never}
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
          <View style={w.topClockBar}><Clock /></View>
          <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={screenOpts} initialRouteName="MesaTickets">
              <Stack.Screen name="MesaTickets" component={AdminMesaTicketsScreen} options={{ title: 'MESAS' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MesaTickets'); } })} />
              {isGeneralAdmin ? <Stack.Screen name="Mesas" component={AdminMesasScreen} options={{ title: 'DEPENDENCIAS' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Mesas'); } })} /> : null}
              <Stack.Screen name="Usuarios" component={AdminUsuariosScreen} options={{ title: 'USUARIOS' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Usuarios'); } })} />
              <Stack.Screen name="Categorias" component={AdminCategoriasScreen} options={{ title: 'CATEGORÍAS' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Categorias'); } })} />
              <Stack.Screen name="Import" options={{ title: 'IMPORT' }} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Import'); } })}>{() => <View style={w.placeholder}><Text style={w.placeholderText}>IMPORT PENDIENTE</Text></View>}</Stack.Screen>
            </Stack.Navigator>
          </View>
        </View>
      </View>
    );
  }

  const mobileTitle = activeName === 'Mesas' ? 'DEPENDENCIAS' : activeName === 'MesaTickets' ? 'MESAS' : activeName === 'Categorias' ? 'CATEGORÍAS' : activeName === 'Import' ? 'IMPORT' : 'USUARIOS';
  return (
    <View style={w.rootMobile}>
      <View style={w.mobileTopBar}>
        <Pressable onPress={() => setDrawerOpen((v) => !v)} style={w.burger} accessibilityRole="button" accessibilityLabel="Abrir menú">
          <Text style={w.burgerText}>☰</Text>
        </Pressable>
        <Text style={w.mobileTitle}>{mobileTitle}</Text>
        <View style={w.clockMobile}><Clock size={13} /></View>
      </View>
      <View style={w.mainMobile}>
        <View style={{ flex: 1 }}>
          <Stack.Navigator screenOptions={{ ...screenOpts, headerShown: false }} initialRouteName="MesaTickets">
            <Stack.Screen name="MesaTickets" component={AdminMesaTicketsScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('MesaTickets'); } })} />
            {isGeneralAdmin ? <Stack.Screen name="Mesas" component={AdminMesasScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Mesas'); } })} /> : null}
            <Stack.Screen name="Usuarios" component={AdminUsuariosScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Usuarios'); } })} />
            <Stack.Screen name="Categorias" component={AdminCategoriasScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Categorias'); } })} />
            <Stack.Screen name="Import" listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Import'); } })}>{() => <View style={w.placeholder}><Text style={w.placeholderText}>IMPORT PENDIENTE</Text></View>}</Stack.Screen>
          </Stack.Navigator>
        </View>
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
  clockMobile: { minWidth: 80, alignItems: 'flex-end' },
  topClockBar: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
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
      <Stack.Screen name="Usuarios" component={AdminUsuariosScreen} options={{ title: 'Usuarios' }} />
    </Stack.Navigator>
  );
}
