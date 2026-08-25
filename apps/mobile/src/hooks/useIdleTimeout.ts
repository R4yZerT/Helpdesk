// RF-04 — Timeout inactividad 30m cliente+servidor (Atributos: Seguridad + Usabilidad + Disponibilidad)
// Escenarios: app background >30m → logout; usuario inactivo sin tocar pantalla 30m → banner + logout; cambio de rol/desactivado → expulsión.
// Servidor ya tiene inactivity_timeout=30m pero cliente hace enforcement preciso sin esperar 401.
import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

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
  const bgAt = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    timer.current = null; warnTimer.current = null;
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
    if (!enabled) { clear(); return; }
    schedule();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') {
        bgAt.current = Date.now();
        clear();
      } else if (s === 'active') {
        // Si estuvo en bg >30m, fuerza logout inmediato
        if (bgAt.current && Date.now() - bgAt.current >= INACTIVITY_MS) onTimeout();
        else if (bgAt.current && Date.now() - lastActive.current >= INACTIVITY_MS) onTimeout();
        else schedule();
        bgAt.current = null;
      }
    });
    return () => { clear(); sub.remove(); };
  }, [enabled, schedule, onTimeout, clear]);

  return { reset };
}
