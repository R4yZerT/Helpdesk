// RF-05 fail-closed — Navegación del tab Tecnico
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '@helpdesk/shared';
import { BandejaTecnicoScreen } from '../features/tecnico/BandejaTecnicoScreen';
import { CreateTicketScreen } from '../features/tickets/CreateTicketScreen';
import { DetalleTecnicoScreen } from '../features/tecnico/DetalleTecnicoScreen';

const Tab = createBottomTabNavigator();
const TecnicoStack = createNativeStackNavigator();

const screenOpts = { headerShown: false, gestureEnabled: true } as const;

function TecnicoStackScreen() {
  return (
    <TecnicoStack.Navigator screenOptions={screenOpts}>
      <TecnicoStack.Screen name="Bandeja" options={{ title: 'Bandeja' }} component={BandejaTecnicoScreen} />
      <TecnicoStack.Screen name="CrearTicket" options={{ title: 'Nueva solicitud' }} component={CreateTicketScreen} />
      <TecnicoStack.Screen name="DetalleTicket" options={{ title: 'Detalle' }} component={DetalleTecnicoScreen as never} />
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