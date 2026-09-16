// RF-04 — Timeout inactividad 30m web (paridad con mobile useIdleTimeout)
// Eventos DOM en vez de AppState: pointer/key/wheel resetean; visibilitychange cubre pestaña oculta.
// Mismas constantes que mobile (30m timeout, aviso 1m antes) alineadas con supabase/config.toml.
import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_MS = 30 * 60 * 1000; // 30m alineado con supabase/config.toml
const WARNING_MS = 60 * 1000; // avisa 1m antes

export function useIdleTimeout(opts: {
  enabled: boolean;
  onTimeout: () => void;
  onWarning?: (remainingMs: number) => void;
}) {
  const { enabled, onTimeout, onWarning } = opts;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActive = useRef<number>(Date.now());
  const hiddenAt = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    timer.current = null;
    warnTimer.current = null;
  }, []);

  const schedule = useCallback(() => {
    clear();
    if (!enabled) return;
    lastActive.current = Date.now();
    if (onWarning) {
      warnTimer.current = setTimeout(() => onWarning(WARNING_MS), INACTIVITY_MS - WARNING_MS);
    }
    timer.current = setTimeout(onTimeout, INACTIVITY_MS);
  }, [enabled, onTimeout, onWarning, clear]);

  // Actividad del usuario resetea timer — exponer reset para tocar en navegación
  const reset = useCallback(() => schedule(), [schedule]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') {
      clear();
      return;
    }
    schedule();
    const onActivity = () => schedule();
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        clear();
      } else {
        // Pestaña oculta >=30m o inactivo >=30m → logout inmediato
        if (hiddenAt.current && Date.now() - hiddenAt.current >= INACTIVITY_MS) onTimeout();
        else if (hiddenAt.current && Date.now() - lastActive.current >= INACTIVITY_MS) onTimeout();
        else schedule();
        hiddenAt.current = null;
      }
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clear();
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, schedule, onTimeout, clear]);

  return { reset };
}
