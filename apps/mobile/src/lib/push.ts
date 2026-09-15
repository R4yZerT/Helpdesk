// RF-23 — Registro de token Expo + canal Android (requiere device físico).
// Retorna null en simulador/web/sin permiso (el in-app realtime sigue funcionando).
// Nota SDK 53+: importar expo-notifications a nivel top-level CRASHEA en
// Expo Go Android, porque su módulo DevicePushTokenAutoRegistration.fx llama
// a addPushTokenListener al importarse (lanza antes de que corra nuestro código).
// Por eso la importación aquí es perezosa (require diferido) y en Expo Go el
// módulo nativo nunca se carga.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsType from 'expo-notifications';

// True cuando la app corre dentro de Expo Go (sin push remoto en SDK 53+).
// Usa la API moderna (executionEnvironment) con fallback a la legacy (appOwnership).
export function esExpoGo(): boolean {
  try {
    const c = Constants as unknown as { appOwnership?: string | null; executionEnvironment?: string };
    if (c.executionEnvironment === 'storeClient') return true;
    return c.appOwnership === 'expo';
  } catch (e) {
    console.log('[push] esExpoGo error:', e instanceof Error ? e.message : e);
    return false;
  }
}

// Importación perezosa del módulo nativo. En web o Expo Go retorna null
// sin cargar expo-notifications (cargarlo ahí lanza en Android SDK 53+).
function getNotifications(): typeof NotificationsType | null {
  if (Platform.OS === 'web' || esExpoGo()) return null;
  try {
    // Carga diferida a propósito: importar expo-notifications en top-level
    // crashea Expo Go Android (SDK 53+). Regla no-var-requires eximida aquí.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications') as typeof NotificationsType;
  } catch (e) {
    console.log('[push] require error:', e instanceof Error ? e.message : e);
    return null;
  }
}

// Muestra la notificación aunque la app esté en primer plano.
// Seguro en Expo Go: no carga el módulo nativo.
export function initPushHandler(): void {
  try {
    getNotifications()?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.log('[push] handler error:', e instanceof Error ? e.message : e);
  }
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const N = getNotifications();
    if (!N) return;
    await N.setNotificationChannelAsync('default', {
      name: 'Avisos',
      importance: N.AndroidImportance.DEFAULT,
    });
  } catch (e) {
    console.log('[push] channel error:', e instanceof Error ? e.message : e);
  }
}

export type PushRegistro = { token: string; plataforma: 'android' | 'ios' | 'web' };

export async function obtenerExpoPushToken(): Promise<PushRegistro | null> {
  try {
    const N = getNotifications();
    if (!N) return null; // web / Expo Go: sin push remoto
    if (!Device.isDevice) return null; // simulador: sin token
    const { status: actual } = await N.getPermissionsAsync();
    const status = actual === 'granted'
      ? actual
      : (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const { data } = await N.getExpoPushTokenAsync();
    if (!data) return null;
    const plataforma = Platform.OS === 'ios' ? 'ios' : 'android';
    return { token: data, plataforma };
  } catch (e) {
    console.log('[push] token error:', e instanceof Error ? e.message : e);
    return null;
  }
}

export type PushSubscription = { remove: () => void };

// Listeners nativos con carga perezosa (null en web / Expo Go).
export function addPushRecibidoListener(
  cb: (ev: NotificationsType.Notification) => void,
): PushSubscription | null {
  try {
    return getNotifications()?.addNotificationReceivedListener(cb) ?? null;
  } catch (e) {
    console.log('[push] listener error:', e instanceof Error ? e.message : e);
    return null;
  }
}

export function addPushRespuestaListener(
  cb: (ev: NotificationsType.NotificationResponse) => void,
): PushSubscription | null {
  try {
    return getNotifications()?.addNotificationResponseReceivedListener(cb) ?? null;
  } catch (e) {
    console.log('[push] listener error:', e instanceof Error ? e.message : e);
    return null;
  }
}
