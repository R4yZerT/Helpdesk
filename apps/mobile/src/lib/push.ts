// RF-23 — Registro de token Expo + canal Android (requiere device físico).
// Retorna null en simulador/web/sin permiso (el in-app realtime sigue funcionando).
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Muestra la notificación aunque la app esté en primer plano.
export function initPushHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Avisos',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export type PushRegistro = { token: string; plataforma: 'android' | 'ios' | 'web' };

export async function obtenerExpoPushToken(): Promise<PushRegistro | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null; // simulador: sin token
  const { status: actual } = await Notifications.getPermissionsAsync();
  const status = actual === 'granted'
    ? actual
    : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const { data } = await Notifications.getExpoPushTokenAsync();
  if (!data) return null;
  const plataforma = Platform.OS === 'ios' ? 'ios' : 'android';
  return { token: data, plataforma };
}
