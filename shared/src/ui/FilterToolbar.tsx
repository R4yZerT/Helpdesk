import * as React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from './theme.js';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  children?: React.ReactNode;
  layout?: 'row' | 'stack';
  style?: StyleProp<ViewStyle>;
};

export function FilterToolbar({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  children,
  layout = 'row',
  style,
}: Props) {
  return (
    <View style={[styles.wrap, layout === 'stack' && styles.stack, style]}>
      <View style={[styles.search, layout === 'stack' && styles.searchStack]}>
        <Text style={styles.searchIcon} accessible={false}>⌕</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mutedSoft}
          style={styles.input}
          returnKeyType="search"
          accessibilityLabel={accessibilityLabel ?? placeholder}
        />
        {value ? (
          <Pressable
            testID="filter-search-clear"
            onPress={() => onChangeText('')}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel={`Limpiar ${accessibilityLabel ?? 'búsqueda'}`}
          >
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>
      {children ? <View style={[styles.filters, layout === 'stack' && styles.filtersStack]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 },
  stack: { flexDirection: 'column', alignItems: 'stretch' },
  search: {
    flex: 1,
    flexBasis: 220,
    minWidth: 180,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.space[3],
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  searchStack: { flex: 0, flexBasis: 'auto', width: '100%' },
  searchIcon: { color: theme.colors.mutedSoft, fontSize: 16 },
  input: { flex: 1, minWidth: 0, height: '100%', paddingVertical: 0, color: theme.colors.text, fontSize: 13 },
  clearButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.full },
  clearText: { color: theme.colors.muted, fontSize: 18, lineHeight: 20 },
  filters: { flex: 1, flexBasis: 220, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8 },
  filtersStack: { flex: 0, flexBasis: 'auto', width: '100%' },
});
