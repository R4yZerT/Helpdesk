// Primitivos UI compartidos — IUE elegante (warm + brass + ink)
import * as React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { theme } from './theme.js';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'danger' | 'success' | 'warning' | 'ink' }) {
  const map: Record<string, { bg: string; color: string; border?: string }> = {
    muted: { bg: theme.colors.surfaceAlt, color: theme.colors.textSoft, border: theme.colors.border },
    accent: { bg: theme.colors.accentMuted, color: '#6B4E1A', border: '#E8D9B5' },
    danger: { bg: '#FEF2F2', color: '#7F1D1D', border: '#FECACA' },
    success: { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
    warning: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
    ink: { bg: theme.colors.primary, color: '#FFFFFF' },
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
  variant?: 'primary' | 'ghost' | 'brass';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }: { pressed: boolean }) => [
        styles.button,
        variant === 'ghost' ? styles.buttonGhost : variant === 'brass' ? styles.buttonBrass : styles.buttonPrimary,
        pressed ? { opacity: 0.92, transform: [{ scale: 0.98 }] } : null,
        disabled ? { opacity: 0.45 } : null,
      ]}
    >
      <Text style={variant === 'ghost' ? styles.buttonGhostText : variant === 'brass' ? styles.buttonBrassText : styles.buttonText}>{title}</Text>
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
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.soft,
  } as ViewStyle,
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  } as ViewStyle,
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' } as TextStyle,
  button: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
  buttonPrimary: { backgroundColor: theme.colors.primary } as ViewStyle,
  buttonBrass: { backgroundColor: theme.colors.accent } as ViewStyle,
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1.2, borderColor: theme.colors.borderStrong } as ViewStyle,
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 } as TextStyle,
  buttonBrassText: { color: theme.colors.primary, fontWeight: '800', fontSize: 14, letterSpacing: 0.3 } as TextStyle,
  buttonGhostText: { color: theme.colors.primary, fontWeight: '700', fontSize: 14 } as TextStyle,
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.accentStrong } as TextStyle,
  sectionTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.4 } as TextStyle,
  sectionSubtitle: { fontSize: 13, color: theme.colors.muted, lineHeight: 18 } as TextStyle,
});
