// H13 — Proveedor de esquema claro/oscuro (web/mobile).
// Fundacion: expone theme reactivo + persistencia. La migracion de las
// 56 pantallas que usan `theme` estatico queda como seguimiento.
import * as React from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, theme, THEME_STORAGE_KEY, type ColorScheme, type Theme } from './theme.js';
import type { AlmacenOnboarding } from '../onboarding.js';

type ThemeContexto = {
  scheme: ColorScheme;
  theme: Theme | typeof darkTheme;
  setScheme: (s: ColorScheme) => void;
  toggle: () => void;
};

const Ctx = React.createContext<ThemeContexto>({
  scheme: 'light',
  theme,
  setScheme: () => {},
  toggle: () => {},
});

export function useTheme(): ThemeContexto {
  return React.useContext(Ctx);
}

type Props = {
  children: React.ReactNode;
  storage?: AlmacenOnboarding | null;
  initial?: ColorScheme | null;
};

export function ThemeProvider({ children, storage = null, initial = null }: Props) {
  const sistema = useColorScheme();
  const [scheme, setSchemeState] = React.useState<ColorScheme>(
    initial ?? (sistema === 'dark' ? 'dark' : 'light'),
  );

  // Restaura preferencia guardada (si hay storage)
  React.useEffect(() => {
    let vivo = true;
    if (!storage) return () => { vivo = false; };
    Promise.resolve(storage.getItem(THEME_STORAGE_KEY))
      .then((v) => {
        if (vivo && (v === 'light' || v === 'dark')) setSchemeState(v);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [storage]);

  const setScheme = React.useCallback((s: ColorScheme) => {
    setSchemeState(s);
    if (storage) {
      try {
        void Promise.resolve(storage.setItem(THEME_STORAGE_KEY, s));
      } catch {
        // Sin persistencia: el esquema vive solo en memoria
      }
    }
  }, [storage]);

  const toggle = React.useCallback(() => {
    setSchemeState((prev) => {
      const next: ColorScheme = prev === 'dark' ? 'light' : 'dark';
      if (storage) {
        try {
          void Promise.resolve(storage.setItem(THEME_STORAGE_KEY, next));
        } catch {
          // Sin persistencia
        }
      }
      return next;
    });
  }, [storage]);

  const value = React.useMemo<ThemeContexto>(() => ({
    scheme,
    theme: scheme === 'dark' ? darkTheme : theme,
    setScheme,
    toggle,
  }), [scheme, setScheme, toggle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
