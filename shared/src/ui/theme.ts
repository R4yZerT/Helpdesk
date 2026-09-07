// Tokens de diseño — IUE HelpDesk · tech moderno (Stitch: #0E87E2 / #FD7C06)
// Fuente: projects/8538278466542593758 HelpDesk IUE Design System
export const theme = {
  colors: {
    // Brand — azul operativo (nav, CTA primario, focus)
    primary: '#0E87E2',
    primaryDark: '#0A5CB8',
    primarySoft: '#EAF3FF',
    // Acento — naranja urgencia (solo críticos, SLA, pico)
    accent: '#FD7C06',
    accentStrong: '#C65A00',
    accentMuted: '#FFF3E6',
    // Tonal tints para tablas/stripes
    blue50: '#EFF6FF',
    orange50: '#FFF7ED',
    // Semánticos
    success: '#0F9D58',
    successSoft: '#EBF7EE',
    warning: '#F59E0B',
    danger: '#DC2626',
    // Neutros fríos (fidelity)
    bg: '#F6F8FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF2F7',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    muted: '#64748B',
    mutedSoft: '#94A3B8',
    // Texto
    text: '#0F172A',
    textSoft: '#334155',
    // Alias legacy para compatibilidad (mapea a nuevos)
    // primarySoft ya existe arriba
  },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, full: 999 },
  spacing: (n: number) => n * 4,
  // Espaciado nombrado Stitch (space-1..16)
  space: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  } as const,
  shadow: {
    soft: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    medium: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    overlay: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.12,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
  },
  font: {
    display: 'Inter',
    body: 'Inter',
    mono: 'JetBrains Mono',
    // fallback nativo
    displayFallback: 'System',
    bodyFallback: 'System',
  },
  // Tipografía Stitch
  typography: {
    displayLg: { fontSize: 40, lineHeight: 48, fontWeight: '700' as const, letterSpacing: -0.8 },
    headlineLg: { fontSize: 32, lineHeight: 40, fontWeight: '600' as const, letterSpacing: -0.64 },
    headlineMd: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.36 },
    headlineSm: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.2 },
    titleMd: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.08 },
    bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
    bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
    labelMd: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.12 },
    codeMd: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
    codeSm: { fontSize: 11, lineHeight: 16, fontWeight: '500' as const },
  },
} as const;

export type Theme = typeof theme;
