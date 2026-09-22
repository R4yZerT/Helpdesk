// H12 — Tarjeta de onboarding con paginador (web/mobile).
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme.js';
import { Card } from './components.js';
import type { PasoOnboarding } from '../onboarding.js';

type Props = {
  pasos: PasoOnboarding[];
  paso: number;
  onSiguiente: () => void;
  onOmitir: () => void;
};

export function OnboardingCard({ pasos, paso, onSiguiente, onOmitir }: Props) {
  const actual = pasos[paso];
  if (!actual) return null;
  const ultimo = paso === pasos.length - 1;
  return (
    <View style={s.overlay} pointerEvents="box-none">
      <Card style={s.card}>
        <Text style={s.kicker}>Paso {paso + 1} de {pasos.length}</Text>
        <Text style={s.title}>{actual.titulo}</Text>
        <Text style={s.body}>{actual.cuerpo}</Text>
        <View style={s.dots}>
          {pasos.map((p) => (
            <View key={p.id} style={[s.dot, p.id === actual.id && s.dotActive]} />
          ))}
        </View>
        <View style={s.row}>
          <Pressable onPress={onOmitir} style={s.skip} accessibilityRole="button" accessibilityLabel="Omitir guía">
            <Text style={s.skipText}>Omitir</Text>
          </Pressable>
          <Pressable onPress={onSiguiente} style={s.next} accessibilityRole="button" accessibilityLabel={ultimo ? 'Entendido' : 'Siguiente'}>
            <Text style={s.nextText}>{ultimo ? 'Entendido' : 'Siguiente'}</Text>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', paddingHorizontal: 24 },
  card: { gap: 8, padding: 18, width: '100%', maxWidth: 420 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.colors.mutedSoft, textTransform: 'uppercase' },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  body: { fontSize: 12, color: theme.colors.muted, lineHeight: 17 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  dotActive: { backgroundColor: theme.colors.primary, width: 18 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  skip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.full },
  skipText: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
  next: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary },
  nextText: { fontSize: 12, fontWeight: '800', color: '#fff' },
});
