// RF-23 móvil — Suscripción realtime a notificaciones + registro de push token.
// In-app: realtime vía shared (campana + badge). Nativo (Expo/FCM/APNS):
// expone registrarToken() listo para cuando se instale expo-notifications
// (pendiente: añadir dependencia + plugin EAS; no se toca eas.json en este cambio).
import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  countNoLeidas, listNotificaciones, registerPushToken,
  subscribeNotificaciones, type Notificacion,
} from '@helpdesk/shared';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function usePushNotificaciones() {
  const { session } = useAuth();
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<Notificacion[]>([]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const [c, list] = await Promise.all([
        countNoLeidas(supabase as never),
        listNotificaciones(supabase as never, { limit: 12 }),
      ]);
      setNoLeidas(c);
      setItems(list);
    } catch {
      // Sin red / sin tabla: la campana muestra estado vacío.
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setNoLeidas(0);
      setItems([]);
      return;
    }
    refresh();
    const unsub = subscribeNotificaciones(supabase as never, (n) => {
      setItems((prev) => [n, ...prev].slice(0, 12));
      setNoLeidas((c) => c + 1);
    });
    const poll = setInterval(refresh, 60000);
    const onAppState = (st: AppStateStatus) => {
      if (st === 'active') refresh();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      unsub();
      clearInterval(poll);
      sub.remove();
    };
  }, [session, refresh]);

  // Registra un token push (Expo/FCM/APNS) en public.push_tokens.
  // Llamar cuando el host nativo entregue el token (expo-notifications pendiente).
  const registrarToken = useCallback(async (token: string, plataforma: 'android' | 'ios' | 'web') => {
    await registerPushToken(supabase as never, token, plataforma);
  }, []);

  return { noLeidas, items, refresh, registrarToken };
}
