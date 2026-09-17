// Telemetría IA — precisión validada por fuente (vista metricas_ia_feedback)
// Muestra qué tan bien clasifica cada fuente según la validación de los técnicos.
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';
import type { MetricaIaFuente } from '../../dashboard.js';

const FUENTE_LABEL: Record<string, string> = {
  beto: 'BETO (modelo)',
  reglas: 'Reglas locales',
  manual: 'Manual',
};

export function PrecisionIa({ data }: { data: MetricaIaFuente[] }) {
  const filas = [...data].sort((a, b) => b.total - a.total);
  const totalValidadas = filas.reduce((s, f) => s + f.confirmadas + f.corregidas, 0);

  // Resumen textual para lector de pantalla
  const resumen = filas.length === 0
    ? 'Sin telemetría de IA: aún no hay sugerencias validadas por los técnicos.'
    : `Precisión IA validada: ${filas.map((f) => `${FUENTE_LABEL[f.fuente] ?? f.fuente} ${f.precisionValidada != null ? `${Math.round(f.precisionValidada * 100)}%` : 'sin datos'} en ${f.confirmadas + f.corregidas} validadas`).join(', ')}.`;

  return (
    <Card style={{ gap: 12 }}>
      <View style={s.header}>
        <Text style={s.title}>Precisión IA validada</Text>
        <Text style={s.subtitle}>{totalValidadas} validadas · técnicos</Text>
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={resumen}>
        {filas.length === 0 ? (
          <Text style={s.empty}>Aún no hay validaciones: la precisión aparece cuando los técnicos confirmen o corrijan sugerencias.</Text>
        ) : (
          filas.map((f) => {
            const validadas = f.confirmadas + f.corregidas;
            const pct = f.precisionValidada != null ? Math.round(f.precisionValidada * 100) : null;
            const conf = f.confianzaPromedio != null ? f.confianzaPromedio.toFixed(2) : '—';
            return (
              <View key={f.fuente} style={s.row}>
                <View style={s.rowHead}>
                  <Text style={s.fuente}>{FUENTE_LABEL[f.fuente] ?? f.fuente}</Text>
                  <Text style={s.pct}>{pct != null ? `${pct}%` : '—'}</Text>
                </View>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${pct ?? 0}%` }]} />
                </View>
                <Text style={s.detail}>
                  {f.confirmadas} confirmadas · {f.corregidas} corregidas · {f.pendientes} pendientes · conf. {conf}
                </Text>
              </View>
            );
          })
        )}
      </View>
      <Text style={s.help}>Precisión = confirmadas / validadas. Si BETO cae bajo el umbral, reentrena con el dataset exportado.</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  subtitle: { fontSize: 10, fontWeight: '600', color: theme.colors.muted },
  empty: { fontSize: 11, color: theme.colors.muted, lineHeight: 16 },
  row: { gap: 4, paddingVertical: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  fuente: { fontSize: 11, fontWeight: '700', color: theme.colors.textSoft },
  pct: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  barBg: { height: 6, backgroundColor: theme.colors.surfaceAlt, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999, backgroundColor: theme.colors.success },
  detail: { fontSize: 10, color: theme.colors.muted },
  help: { fontSize: 10, color: theme.colors.mutedSoft, lineHeight: 14 },
});
