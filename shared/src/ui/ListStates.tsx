// Estados compartidos de carga, lista vacía y paginación.
import * as React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { theme } from './theme.js';

export type ListLoadingProps = {
  label?: string;
  color?: string;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function ListLoading({
  label,
  color = theme.colors.primary,
  fullScreen = false,
  style,
  children,
}: ListLoadingProps) {
  return (
    <View style={[styles.loading, fullScreen && styles.loadingFullScreen, style]}>
      <ActivityIndicator color={color} />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

export type EmptyStateProps = {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  surface?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

export function EmptyState({
  title,
  description,
  children,
  surface = false,
  style,
  titleStyle,
}: EmptyStateProps) {
  return (
    <View style={[styles.empty, surface && styles.emptySurface, style]}>
      <Text style={[styles.emptyTitle, titleStyle]}>{title}</Text>
      {typeof description === 'string' ? (
        <Text style={styles.emptyDescription}>{description}</Text>
      ) : (
        description
      )}
      {children}
    </View>
  );
}

export type ListFooterProps = {
  loading: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function ListFooter({
  loading,
  color = theme.colors.primary,
  style,
}: ListFooterProps) {
  if (!loading) return null;
  return (
    <View style={[styles.footer, style]}>
      <ActivityIndicator color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
    padding: theme.space[4],
  },
  loadingFullScreen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  loadingLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
    padding: theme.space[6],
  },
  emptySurface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    color: theme.colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    padding: theme.space[3],
  },
});
