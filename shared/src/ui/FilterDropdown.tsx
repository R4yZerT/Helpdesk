// Lista desplegable discreta — anclada debajo del trigger, angosta
import * as React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme.js';

export type DropdownOption<T extends string | number | boolean> = {
  value: T;
  label: string;
};

type Props<T extends string | number | boolean> = {
  label: string;
  value: T | '' | 'todos';
  options: DropdownOption<T | '' | 'todos'>[];
  onSelect: (value: T | '' | 'todos') => void;
  placeholder?: string;
  testID?: string;
};

export function FilterDropdown<T extends string | number | boolean>({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Seleccionar',
}: Props<T>) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const triggerRef = React.useRef<View>(null);
  const selected = options.find((o) => String(o.value) === String(value));

  const handleOpen = React.useCallback(() => {
    const node = triggerRef.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      measure?: (cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void) => void;
    } | null;
    const doMeasure = () => {
      if (node && typeof node.measureInWindow === 'function') {
        try {
          node.measureInWindow((x, y, w, h) => {
            // y es ventana; si sale 0 o muy arriba, fallback a measure
            if (y < 10 && typeof node.measure === 'function') {
              node.measure((_x, _y, w2, h2, px, py) => {
                setAnchor({ x: px, y: py, w: w2, h: h2 });
                setOpen(true);
              });
            } else {
              setAnchor({ x, y, w, h });
              setOpen(true);
            }
          });
          return;
        } catch {}
      }
      setAnchor(null);
      setOpen(true);
    };
    // pequeño delay para asegurar layout en web
    requestAnimationFrame(() => setTimeout(doMeasure, 30));
  }, []);

  const dropdownStyle = anchor
    ? {
        position: 'absolute' as const,
        top: anchor.y + anchor.h + 6,
        left: Math.max(8, Math.min(anchor.x, 9999)),
        width: Math.min(Math.max(anchor.w, 160), 200),
      }
    : { position: 'absolute' as const, top: 120, left: 16, width: 180 } as const;

  const innerStyle = anchor
    ? { width: '100%' as const }
    : { width: '100%' as const, maxWidth: 200 as unknown as number };

  return (
    <View style={s.wrap} ref={triggerRef} collapsable={false}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [s.trigger, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
      >
        <Text style={[s.triggerText, !selected && s.placeholderText]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={s.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <View style={dropdownStyle} pointerEvents="box-none">
          <View style={[s.dropdownInner, innerStyle]}>
            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((opt) => {
                const active = String(opt.value) === String(value);
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [s.option, active && s.optionActive, pressed && s.optionPressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.optionText, active && s.optionTextActive]} numberOfLines={1}>
                      {opt.label}
                    </Text>
                    {active ? <Text style={s.check}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 5, minWidth: 132, flex: 1 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: theme.colors.mutedSoft },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  triggerText: { fontSize: 12, fontWeight: '600', color: theme.colors.text, flex: 1 },
  placeholderText: { color: theme.colors.mutedSoft, fontWeight: '400' },
  chevron: { fontSize: 11, color: theme.colors.mutedSoft, fontWeight: '700', marginLeft: 4 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' } as unknown as object,
  dropdownInner: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  } as unknown as object,
  scroll: { maxHeight: 200 },
  scrollContent: { paddingVertical: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  optionActive: { backgroundColor: theme.colors.surfaceAlt },
  optionPressed: { opacity: 0.7 },
  optionText: { fontSize: 12, fontWeight: '500', color: theme.colors.text, flex: 1 },
  optionTextActive: { fontWeight: '700', color: theme.colors.primaryDark },
  check: { fontSize: 12, fontWeight: '800', color: theme.colors.primary },
});
