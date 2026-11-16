// Encabezado de pantalla compartido — título, kicker, subtítulo y acciones.
import * as React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../theme.js';

export type ScreenHeaderProps = {
  title: string;
  kicker?: string;
  kickerDot?: boolean;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  surface?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
  title,
  kicker,
  kickerDot = false,
  subtitle,
  actions,
  children,
  surface = false,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[s.wrap, surface && s.surface, style]}>
      {kicker ? (
        <View style={s.kickerRow}>
          {kickerDot ? <View style={s.kickerDot} /> : null}
          <Text style={s.kicker}>{kicker}</Text>
        </View>
      ) : null}
      <View style={s.titleRow}>
        <Text style={s.title}>{title}</Text>
        {actions ? <View style={s.actions}>{actions}</View> : null}
      </View>
      {typeof subtitle === 'string' ? <Text style={s.subtitle}>{subtitle}</Text> : subtitle}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.space[4],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[3],
    gap: theme.space[2] - 2,
  },
  surface: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  kickerDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.primary },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: theme.colors.muted, textTransform: 'uppercase' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space[3] },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4, flex: 1 },
  actions: { flexShrink: 0 },
  subtitle: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
});
