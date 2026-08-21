// Primitivos UI compartidos — usan react-native (renderiza en web vía react-native-web)
import * as React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { theme } from './theme.js';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'danger' | 'success' }) {
  const bg =
    tone === 'accent' ? theme.colors.accent : tone === 'danger' ? theme.colors.danger : tone === 'success' ? theme.colors.success : theme.colors.border;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.badgeText}>{label}</Text>
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
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }: { pressed: boolean }) => [
        styles.button,
        variant === 'ghost' ? styles.buttonGhost : styles.buttonPrimary,
        pressed ? { opacity: 0.85 } : null,
        disabled ? { opacity: 0.5 } : null,
      ]}
    >
      <Text style={variant === 'ghost' ? styles.buttonGhostText : styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  } as ViewStyle,
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  } as ViewStyle,
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' } as TextStyle,
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.md, alignItems: 'center' } as ViewStyle,
  buttonPrimary: { backgroundColor: theme.colors.primary } as ViewStyle,
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border } as ViewStyle,
  buttonText: { color: '#fff', fontWeight: '600' } as TextStyle,
  buttonGhostText: { color: theme.colors.primary, fontWeight: '600' } as TextStyle,
});
