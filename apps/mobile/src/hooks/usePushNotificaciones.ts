// RF-23 móvil — Realtime in-app + push nativo (Expo/FCM/APNS).
// - In-app: realtime vía shared (campana + badge) con polling de respaldo 60s.
// - Nativo: obtiene token Expo en device físico, lo registra en push_tokens,
//   muestra foreground y abre el ticket al tocar la notificación.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import {
  countNoLeidas, listNotificaciones, registerPushToken,
  subscribeNotificaciones, type Notificacion,
} from '@helpdesk/shared';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { abrirTicketDesdePush, drenarTicketsPendientes, encolarTicketPendiente, extraerTicketIdDeUrl } from '../navigation/navigationRef';
import {
  addPushRecibidoListener, addPushRespuestaListener, ensureAndroidChannel,
  initPushHandler, obtenerExpoPushToken, obtenerTicketIdInicialPush,
} from '../lib/push';

// Handler seguro: en Expo Go no lanza (ver push.ts).
initPushHandler();

export function usePushNotificaciones() {
  const { session } = useAuth();
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<Notificacion[]>([]);
  const tokenRegistrado = useRef<string | null>(null);

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
    // La sesión ya cargó (árbol por rol montado): drenar taps encolados.
    drenarTicketsPendientes();
  }, [session]);

  // Registra el token Expo una vez por sesión (solo device físico).
  // En Expo Go SDK 53+ retorna sin hacer nada (push remoto no disponible).
  const registrarTokenNativo = useCallback(async () => {
    try {
      await ensureAndroidChannel();
      const reg = await obtenerExpoPushToken();
      if (!reg || tokenRegistrado.current === reg.token) return;
      tokenRegistrado.current = reg.token;
      await registerPushToken(supabase as never, reg.token, reg.plataforma);
    } catch {
      // Sin permiso / sin device / sin red: el in-app sigue funcionando.
      tokenRegistrado.current = null;
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setNoLeidas(0);
      setItems([]);
      tokenRegistrado.current = null;
      return;
    }
    refresh();
    registrarTokenNativo();
    // Cold-start: tap con app muerta o URL inicial (sesión restaurada después).
    let cancelado = false;
    (async () => {
      try {
        const [ticketPush, urlInicial] = await Promise.all([
          obtenerTicketIdInicialPush(),
          Linking.getInitialURL().catch(() => null),
        ]);
        if (cancelado) return;
        if (ticketPush) encolarTicketPendiente(ticketPush);
        const ticketUrl = extraerTicketIdDeUrl(urlInicial);
        if (ticketUrl) encolarTicketPendiente(ticketUrl);
        drenarTicketsPendientes();
      } catch {
        // Sin push nativo / sin URL: nada que drenar.
      }
    })();
    // Deep-link en caliente (helpdesk://ticket/<id> con app abierta).
    const subUrl = Linking.addEventListener('url', ({ url }) => {
      const ticketId = extraerTicketIdDeUrl(url);
      if (ticketId) {
        encolarTicketPendiente(ticketId);
        drenarTicketsPendientes();
      }
    });
    const unsub = subscribeNotificaciones(supabase as never, (n) => {
      setItems((prev) => [n, ...prev].slice(0, 12));
      setNoLeidas((c) => c + 1);
    });
    const poll = setInterval(refresh, 60000);
    const onAppState = (st: AppStateStatus) => {
      if (st === 'active') refresh();
    };
    const sub = AppState.addEventListener('change', onAppState);

    // Foreground: refresca y antepone el aviso.
    // Carga perezosa: en web o Expo Go retorna null (solo in-app realtime).
    const recv = addPushRecibidoListener((ev) => {
      const data = (ev.request.content.data ?? {}) as { notificacion_id?: number; ticket_id?: string | null; tipo?: string };
      refresh();
      if (data.notificacion_id) {
        setItems((prev) => [{
          id: data.notificacion_id!,
          usuario_id: '',
          tipo: data.tipo ?? 'push',
          titulo: ev.request.content.title ?? 'Aviso',
          cuerpo: ev.request.content.body ?? null,
          ticket_id: data.ticket_id ?? null,
          leida: false,
          creado_en: new Date().toISOString(),
        }, ...prev].slice(0, 12));
        setNoLeidas((c) => c + 1);
      }
    });
    // Tap: abre el ticket asociado.
    const resp = addPushRespuestaListener((ev) => {
      const data = (ev.notification.request.content.data ?? {}) as { ticket_id?: string | null };
      if (data.ticket_id) abrirTicketDesdePush(data.ticket_id);
      refresh();
    });

    return () => {
      cancelado = true;
      unsub();
      clearInterval(poll);
      sub.remove();
      subUrl.remove();
      recv?.remove();
      resp?.remove();
    };
  }, [session, refresh, registrarTokenNativo]);

  // Registro manual (p. ej. reintento tras conceder permiso).
  const registrarToken = useCallback(async (token: string, plataforma: 'android' | 'ios' | 'web') => {
    await registerPushToken(supabase as never, token, plataforma);
  }, []);

  return { noLeidas, items, refresh, registrarToken, registrarTokenNativo };
}
