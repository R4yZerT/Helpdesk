// TecnicoNavigator — web AppShell + sidebar global + footer legal (Stitch)
import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, Sidebar, IconInbox, IconPlus } from '@helpdesk/shared';
import { BandejaTecnicoScreen } from './BandejaTecnicoScreen';
import { DetalleTecnicoScreen } from './DetalleTecnicoScreen';
import { CreateTicketScreen } from '../tickets/CreateTicketScreen';
import type { TecnicoStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

const Stack = createNativeStackNavigator<TecnicoStackParamList>();

const screenOpts = {
  headerStyle: { backgroundColor: theme.colors.surface } as const,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

function TecnicoWeb() {
  const [activeName, setActiveName] = React.useState('Bandeja');
  const { profile, signOut } = useAuth();
  return <TecnicoWebInner activeName={activeName} setActiveName={setActiveName} profile={profile} signOut={signOut} />;
}

function TecnicoWebInner({ activeName, setActiveName, profile, signOut }: { activeName: string; setActiveName: (n: string) => void; profile: { full_name?: string | null; email?: string | null; rol: string } | null; signOut: () => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [nav, setNav] = React.useState<import('@react-navigation/native').NavigationProp<TecnicoStackParamList> | null>(null);

  const isActive = (id: string) => {
    if (id === 'bandeja') return activeName === 'Bandeja' || activeName === 'DetalleTicket';
    if (id === 'crear') return activeName === 'CrearTicket';
    return false;
  };
  // Fix pantalla blanca: si ya está en la ruta no navegar; si el target ya está en el stack (ej volver a Bandeja desde Crear) hacer popToTop antes de navegar
  const navigateAndClose = (name: string) => {
    if (activeName === name) { setDrawerOpen(false); return; }
    try {
      const anyNav = nav as unknown as { getState?: () => { routes: { name: string }[]; index: number }; popToTop?: () => void };
      const st = anyNav?.getState?.();
      const hasTarget = st?.routes?.some((r) => r.name === name);
      const isRoot = name === 'Bandeja';
      if (hasTarget && isRoot && typeof anyNav?.popToTop === 'function') {
        anyNav.popToTop();
        const st2 = anyNav.getState?.();
        if (st2?.routes?.[st2.index]?.name !== name) nav?.navigate(name as never);
        setDrawerOpen(false);
        return;
      }
    } catch {}
    nav?.navigate(name as never);
    setDrawerOpen(false);
  };
  const iconColor = (active: boolean) => (active ? theme.colors.primaryDark : theme.colors.muted);
  const sidebarContent = (
    <Sidebar
      items={[
        { id: 'bandeja', label: 'Bandeja Asignada', active: isActive('bandeja'), onPress: () => navigateAndClose('Bandeja'), icon: <IconInbox size={14} color={iconColor(isActive('bandeja'))} /> },
        { id: 'crear', label: 'Nueva solicitud', active: isActive('crear'), onPress: () => navigateAndClose('CrearTicket'), icon: <IconPlus size={14} color={iconColor(isActive('crear'))} /> },
      ]}
      user={profile ? { name: (profile.full_name ?? profile.email ?? 'Técnico') as string, role: profile.rol } : undefined}
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
              <Stack.Screen name="Bandeja" options={{ title: 'Bandeja' }} component={BandejaTecnicoScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Bandeja'); } })} />
              <Stack.Screen name="CrearTicket" options={{ title: 'Crear solicitud' }} component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
              <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleTecnicoScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
            </Stack.Navigator>
          </View>
        </View>
      </View>
    );
  }

  const mobileTitle = activeName === 'CrearTicket' ? 'Nueva solicitud' : activeName === 'DetalleTicket' ? 'Detalle' : 'Bandeja';
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
            <Stack.Screen name="Bandeja" component={BandejaTecnicoScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('Bandeja'); } })} />
            <Stack.Screen name="CrearTicket" component={CreateTicketScreen} listeners={({ navigation }) => ({ focus: () => { setNav(navigation as unknown as never); setActiveName('CrearTicket'); } })} />
            <Stack.Screen name="DetalleTicket" component={DetalleTecnicoScreen} listeners={{ focus: () => setActiveName('DetalleTicket') }} />
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
  mobileTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 50, flexDirection: 'row' },
  drawer: { width: 256, backgroundColor: theme.colors.surface, padding: 16, borderRightWidth: 1, borderRightColor: theme.colors.border, height: '100%' },
});

export function TecnicoNavigator() {
  if (Platform.OS === 'web') return <TecnicoWeb />;
  // native: stack simple (tabs previstos)
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Bandeja" options={{ title: 'Bandeja' }} component={BandejaTecnicoScreen} />
      <Stack.Screen name="CrearTicket" options={{ title: 'Crear solicitud' }} component={CreateTicketScreen} />
      <Stack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleTecnicoScreen} />
    </Stack.Navigator>
  );
}
