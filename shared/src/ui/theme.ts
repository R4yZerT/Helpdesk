// Tokens de diseno — single source para mobile y web
export const theme = {
  colors: {
    primary: '#0f172a',
    accent: '#2563eb',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    bg: '#f8fafc',
    surface: '#ffffff',
    muted: '#64748b',
    border: '#e2e8f0',
  },
  radius: { sm: 8, md: 12, lg: 16, full: 999 },
  spacing: (n: number) => n * 4,
} as const;
