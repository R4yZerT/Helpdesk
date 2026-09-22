// H12 — Onboarding contextual: guía de primer uso por rol.
// Lógica pura + hook con storage inyectable (AsyncStorage en mobile,
// localStorage en web). Sin dependencias nativas en shared.
import * as React from 'react';

export const ONBOARDING_VERSION = 1;

export type RolOnboarding = 'usuario' | 'tecnico' | 'jefe' | 'administrador';

export type PasoOnboarding = {
  id: string;
  titulo: string;
  cuerpo: string;
};

export type AlmacenOnboarding = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
};

export function claveOnboarding(version: number = ONBOARDING_VERSION): string {
  return `onboarding.v${version}.visto`;
}

// Valor guardado distinto de '1' (o ausente) => mostrar guía.
export function debeMostrarOnboarding(valorGuardado: string | null): boolean {
  return valorGuardado !== '1';
}

const PASOS_BASE: PasoOnboarding[] = [
  {
    id: 'bienvenida',
    titulo: 'Bienvenido a HelpDesk',
    cuerpo: 'Gestiona tus solicitudes de soporte en un solo lugar: crea, sigue el estado y confirma el cierre.',
  },
];

const PASOS_POR_ROL: Record<RolOnboarding, PasoOnboarding[]> = {
  usuario: [
    { id: 'crear', titulo: 'Crea tu solicitud', cuerpo: 'Describe el problema con detalle: la IA sugiere dependencia y categoría automáticamente.' },
    { id: 'seguir', titulo: 'Sigue el avance', cuerpo: 'Desde Mis solicitudes ves el estado, el SLA y los comentarios del técnico.' },
    { id: 'cerrar', titulo: 'Confirma el cierre', cuerpo: 'Cuando el técnico solucione, confirma el cierre o devuelve el ticket si persiste.' },
  ],
  tecnico: [
    { id: 'bandeja', titulo: 'Tu bandeja asignada', cuerpo: 'Ordenada por prioridad y antigüedad. El badge SLA avisa vencimientos.' },
    { id: 'resolver', titulo: 'Resuelve con trazabilidad', cuerpo: 'Registra la solución aplicada: queda en el historial del expediente.' },
  ],
  jefe: [
    { id: 'tablero', titulo: 'Tablero y alertas IA', cuerpo: 'KPIs, picos previstos y precisión validada del clasificador en el dashboard.' },
    { id: 'reasignar', titulo: 'Reasigna y equilibra', cuerpo: 'Mueve tickets entre técnicos y vigila la carga por dependencia.' },
  ],
  administrador: [
    { id: 'gestion', titulo: 'Usuarios y dependencias', cuerpo: 'Administra usuarios, mesas, categorías y permisos desde el panel Admin.' },
    { id: 'salud', titulo: 'Salud del sistema', cuerpo: 'Revisa métricas, telemetría IA y reentrenamiento del modelo BETO.' },
  ],
};

export function pasosOnboarding(rol: RolOnboarding): PasoOnboarding[] {
  return [...PASOS_BASE, ...(PASOS_POR_ROL[rol] ?? [])];
}

export async function obtenerEstadoOnboarding(
  storage: AlmacenOnboarding,
  version: number = ONBOARDING_VERSION,
): Promise<boolean> {
  try {
    const v = await storage.getItem(claveOnboarding(version));
    return debeMostrarOnboarding(v);
  } catch {
    return false;
  }
}

export async function marcarOnboardingVisto(
  storage: AlmacenOnboarding,
  version: number = ONBOARDING_VERSION,
): Promise<void> {
  try {
    await storage.setItem(claveOnboarding(version), '1');
  } catch {
    // No bloquear la app si el storage falla
  }
}

export function useOnboarding(storage: AlmacenOnboarding | null, rol: RolOnboarding | null) {
  const [visible, setVisible] = React.useState(false);
  const [paso, setPaso] = React.useState(0);
  const pasos = React.useMemo(() => (rol ? pasosOnboarding(rol) : []), [rol]);

  React.useEffect(() => {
    let vivo = true;
    if (!storage || !rol) return () => { vivo = false; };
    obtenerEstadoOnboarding(storage).then((mostrar) => {
      if (vivo && mostrar) setVisible(true);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [storage, rol]);

  const cerrar = React.useCallback(() => {
    if (storage) void marcarOnboardingVisto(storage);
    setVisible(false);
    setPaso(0);
  }, [storage]);

  const siguiente = React.useCallback(() => {
    if (paso + 1 >= pasos.length) cerrar();
    else setPaso((p) => p + 1);
  }, [paso, pasos.length, cerrar]);

  return { visible: visible && pasos.length > 0, pasos, paso, siguiente, cerrar };
}
