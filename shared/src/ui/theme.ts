// Tokens de diseño — IUE HelpDesk · institucional refinada (warm paper + ink + brass)
export const theme = {
  colors: {
    // Base
    primary: '#0B1220', // ink
    primarySoft: '#1E293B',
    accent: '#C8A96A', // brass
    accentStrong: '#A9894E',
    accentMuted: '#F5EAD0',
    // Semánticos
    success: '#0F7A4A',
    warning: '#B45309',
    danger: '#B42318',
    // Neutros warm
    bg: '#F8F6F1', // paper
    surface: '#FFFFFF',
    surfaceAlt: '#F1EFE9',
    muted: '#6B7280',
    mutedSoft: '#9AA0A8',
    border: '#E7E5E0',
    borderStrong: '#D6D3CC',
    // Texto
    text: '#0B1220',
    textSoft: '#3F4756',
  },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, full: 999 },
  spacing: (n: number) => n * 4,
  shadow: {
    soft: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    medium: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.10,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
  },
  font: {
    display: 'System',
    body: 'System',
  },
} as const;

export type Theme = typeof theme;
