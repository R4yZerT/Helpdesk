// Primitivos UI compartidos — tech moderno (Stitch: azul #0E87E2 / naranja #FD7C06)
import * as React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { theme } from './theme.js';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style as ViewStyle]}>{children}</View>;
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'danger' | 'success' | 'warning' | 'info' | 'ink' }) {
  const map: Record<string, { bg: string; color: string; border?: string }> = {
    muted: { bg: theme.colors.surfaceAlt, color: theme.colors.textSoft, border: theme.colors.border },
    // info = En progreso / Abierto — azul soft
    info: { bg: theme.colors.primarySoft, color: theme.colors.primaryDark, border: '#DBEAFE' },
    // accent = Crítico / Pico — naranja
    accent: { bg: theme.colors.accentMuted, color: theme.colors.accentStrong, border: '#FED7AA' },
    danger: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
    success: { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
    warning: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
    ink: { bg: theme.colors.text, color: '#FFFFFF' },
  };
  const t = map[tone] ?? map.muted;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border ?? 'transparent', borderWidth: t.border ? 1 : 0 }]}>
      <Text style={[styles.badgeText, { color: t.color }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'accent' | 'brass';
  disabled?: boolean;
}) {
  // primario = azul #0E87E2, accent = naranja #FD7C06 solo para urgencia
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }: { pressed: boolean }) => [
        styles.button,
        variant === 'ghost' ? styles.buttonGhost : variant === 'accent' || variant === 'brass' ? styles.buttonAccent : styles.buttonPrimary,
        pressed ? { opacity: 0.92, transform: [{ scale: 0.98 }] } : null,
        disabled ? { opacity: 0.45 } : null,
      ]}
    >
      <Text style={variant === 'ghost' ? styles.buttonGhostText : variant === 'accent' || variant === 'brass' ? styles.buttonAccentText : styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function SectionHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: theme.colors.border }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, // 20px Stitch
    padding: 20, // space-5
    borderWidth: 1,
    borderColor: theme.colors.border, // #E2E8F0
    ...theme.shadow.soft, // 0 1 3 rgba(15,23,42,0.05)
  } as ViewStyle,
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  } as ViewStyle,
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' } as TextStyle,
  button: {
    paddingHorizontal: 16,
    height: 44, // Stitch touch target mobile
    borderRadius: 10, // radius-sm
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  } as ViewStyle,
  buttonPrimary: { backgroundColor: theme.colors.primary } as ViewStyle, // #0E87E2 hover #0A5CB8
  buttonAccent: { backgroundColor: theme.colors.accent } as ViewStyle, // #FD7C06 solo urgencia
  buttonGhost: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border } as ViewStyle,
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 } as TextStyle,
  buttonAccentText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 } as TextStyle,
  buttonGhostText: { color: theme.colors.textSoft, fontWeight: '600', fontSize: 14 } as TextStyle,
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.primary } as TextStyle,
  sectionTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 } as TextStyle,
  sectionSubtitle: { fontSize: 13, color: theme.colors.muted, lineHeight: 18 } as TextStyle,
});
