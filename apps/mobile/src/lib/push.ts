// RF-23 — Registro de token Expo + canal Android (requiere device físico).
// Retorna null en simulador/web/sin permiso (el in-app realtime sigue funcionando).
// Nota SDK 53+: el push remoto fue removido de Expo Go en Android, por eso
// este módulo es tolerante a Expo Go (retorna null sin lanzar).
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// True cuando la app corre dentro de Expo Go (sin push remoto en SDK 53+).
export function esExpoGo(): boolean {
  try {
    return Constants.appOwnership === 'expo';
  } catch {
    return false;
  }
}

// Muestra la notificación aunque la app esté en primer plano.
// Seguro en Expo Go: si falla, el in-app realtime sigue funcionando.
export function initPushHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Ignorar en Expo Go / web.
  }
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (esExpoGo()) return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // Expo Go SDK 53+ sin canal remoto: ignorar.
  }
}

export type PushRegistro = { token: string; plataforma: 'android' | 'ios' | 'web' };

export async function obtenerExpoPushToken(): Promise<PushRegistro | null> {
  if (Platform.OS === 'web') return null;
  if (esExpoGo()) return null; // SDK 53+: push remoto removido de Expo Go
  if (!Device.isDevice) return null; // simulador: sin token
  try {
    const { status: actual } = await Notifications.getPermissionsAsync();
    const status = actual === 'granted'
      ? actual
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const { data } = await Notifications.getExpoPushTokenAsync();
    if (!data) return null;
    const plataforma = Platform.OS === 'ios' ? 'ios' : 'android';
    return { token: data, plataforma };
  } catch {
    // Expo Go / sin FCM / sin red: el in-app sigue funcionando.
    return null;
  }
}
