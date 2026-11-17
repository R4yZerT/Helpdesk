// Opciones de navegación compartidas — evita repetir tokens de header/tabs en web y móvil.
import { theme } from '../theme.js';

export const APP_HEADER_OPTIONS = {
  headerStyle: { backgroundColor: theme.colors.surface },
  headerTintColor: theme.colors.primary,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 14 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.bg },
};

export const APP_TAB_OPTIONS = {
  headerShown: false as const,
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: theme.colors.muted,
  tabBarStyle: {
    height: 62,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
};
