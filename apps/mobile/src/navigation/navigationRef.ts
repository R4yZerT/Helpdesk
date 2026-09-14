// Ref global de navegación para abrir tickets desde respuestas a notificaciones
// (el hook usePushNotificaciones vive fuera del NavigationContainer).
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// Tabs que alojan un stack con pantalla DetalleTicket (ver cada Navigator por rol).
// Se usa cuando la campana está montada en un header de Tab sin DetalleTicket directo
// (ej. JefeCrearTab, AdminPerfilTab): se entra por ruta anidada tab → stack → detalle.
const TABS_CON_DETALLE = ['MisTab', 'TecnicoBandejaTab', 'JefeDashTab', 'AdminMainTab'];

// Busca en el estado raíz el tab actual que contiene un stack con DetalleTicket.
function encontrarTabConDetalle(): string | null {
  try {
    const state = navigationRef.getState();
    const tabs = state?.routes?.map((r) => r.name) ?? [];
    return TABS_CON_DETALLE.find((t) => tabs.includes(t)) ?? null;
  } catch {
    return null;
  }
}

// ¿Algún navigator entre nav y la raíz registra DetalleTicket?
// Necesario porque navigate() a ruta desconocida NO lanza (solo warning y no-op).
function cadenaTieneDetalle(nav: unknown): boolean {
  let cur = nav as { getState?: () => { routeNames?: string[] }; getParent?: () => unknown } | undefined;
  while (cur) {
    try {
      if (cur.getState?.().routeNames?.includes('DetalleTicket')) return true;
    } catch { /* seguir subiendo */ }
    try {
      cur = (typeof cur.getParent === 'function' ? cur.getParent() : undefined) as typeof cur;
    } catch {
      return false;
    }
  }
  return false;
}

// Intento local (preserva el tab actual): solo si la cadena lo soporta.
// Se usa desde HeaderBell con la navegación de la pantalla donde está montada.
export function abrirTicketLocal(nav: unknown, ticketId: string): boolean {
  if (!cadenaTieneDetalle(nav)) return false;
  try {
    (nav as unknown as { navigate: (r: string, p?: object) => void })
      .navigate('DetalleTicket', { id: ticketId });
    return true;
  } catch {
    return false;
  }
}

// Abre el detalle desde la campana o el push entrando por el tab anidado
// (tab → stack → DetalleTicket). Funciona desde cualquier header de Tab.
// Causa del bug original: navigate('DetalleTicket') directo desde headers de Tab no resolvía.
export function abrirTicketDesdeCampana(ticketId: string): boolean {
  if (!navigationRef.isReady()) return false;
  const tab = encontrarTabConDetalle();
  if (!tab) return false;
  try {
    (navigationRef as unknown as { navigate: (r: string, p?: object) => void })
      .navigate(tab, { screen: 'DetalleTicket', params: { id: ticketId } });
    return true;
  } catch {
    return false;
  }
}

export function abrirTicketDesdePush(ticketId: string): boolean {
  return abrirTicketDesdeCampana(ticketId);
}
