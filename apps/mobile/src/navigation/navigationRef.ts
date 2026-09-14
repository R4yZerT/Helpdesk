// Ref global de navegación para abrir tickets desde respuestas a notificaciones
// (el hook usePushNotificaciones vive fuera del NavigationContainer).
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function abrirTicketDesdePush(ticketId: string): boolean {
  if (!navigationRef.isReady()) return false;
  try {
    (navigationRef as unknown as { navigate: (r: string, p?: object) => void })
      .navigate('DetalleTicket', { id: ticketId });
    return true;
  } catch {
    return false;
  }
}
