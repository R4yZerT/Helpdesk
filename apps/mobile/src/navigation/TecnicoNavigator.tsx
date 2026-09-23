// RF-05 fail-closed — Navegación del tab Tecnico
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme, withScreenBoundary } from '@helpdesk/shared';
import { BandejaTecnicoScreen } from '../features/tecnico/BandejaTecnicoScreen';
import { CreateTicketScreen } from '../features/tickets/CreateTicketScreen';
import { DetalleTecnicoScreen } from '../features/tecnico/DetalleTecnicoScreen';
import { reportError } from '../lib/sentry';

const Tab = createBottomTabNavigator();
const TecnicoStack = createNativeStackNavigator();

const screenOpts = { headerShown: false, gestureEnabled: true } as const;

// H6 — cada pantalla aislada: si una rompe, el resto del navigator sigue vivo
const BandejaAislada = withScreenBoundary(BandejaTecnicoScreen, { titulo: 'La bandeja no pudo cargarse', onError: (e) => reportError(e, { flujo: 'tecnico-bandeja' }) });
const CrearAislado = withScreenBoundary(CreateTicketScreen, { titulo: 'La creación no pudo cargarse', onError: (e) => reportError(e, { flujo: 'tecnico-crear' }) });
const DetalleAislado = withScreenBoundary(DetalleTecnicoScreen as never, { titulo: 'El detalle no pudo cargarse', onError: (e) => reportError(e, { flujo: 'tecnico-detalle' }) });

function TecnicoStackScreen() {
  return (
    <TecnicoStack.Navigator screenOptions={screenOpts}>
      <TecnicoStack.Screen name="Bandeja" options={{ title: 'Bandeja' }} component={BandejaAislada} />
      <TecnicoStack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CrearAislado} />
      <TecnicoStack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleAislado} />
    </TecnicoStack.Navigator>
  );
}

export function TecnicoNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.primary }}>
      <Tab.Screen name="Bandeja" component={TecnicoStackScreen} />
    </Tab.Navigator>
  );
}