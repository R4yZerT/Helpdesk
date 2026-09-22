// RF-16 — Fila de 4 KPIs del Dashboard (compartida web/mobile)
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { KpiCard } from '../charts/KpiCard.js';

type Props = {
  kpis: { abiertos: number; slaRiesgo: number; ttrHoras: number; ingresadosHoy: number; total: number; slaVencidos?: number; slaPorVencer?: number } | null;
  isWide: boolean;
};

export function KpiRow({ kpis, isWide }: Props) {
  const slaDelta = kpis
    ? (kpis.slaVencidos != null ? `${kpis.slaVencidos} vencidos · ${kpis.slaPorVencer ?? 0} por vencer` : kpis.slaRiesgo > 0 ? `${kpis.slaRiesgo} en riesgo` : 'Dentro de compromiso')
    : '<45 min';
  const deltaTone = (kpis?.slaVencidos ?? 0) > 0 ? ('danger' as const) : (kpis?.slaRiesgo ?? 0) > 0 ? ('warn' as const) : undefined;

  return (
    <View style={[s.grid, !isWide && s.gridCollapsed]}>
      <KpiCard label="Tickets abiertos" value={String(kpis?.abiertos ?? 0)} delta="+12% vs ayer" />
      <KpiCard label="SLA en riesgo" value={String(kpis?.slaRiesgo ?? 0)} delta={slaDelta} deltaTone={deltaTone} accent="orange" />
      <KpiCard label="Tiempo medio" value={`${kpis?.ttrHoras ?? 4.2}h`} delta="-0.3h" />
      <KpiCard label="Ingresados hoy" value={String(kpis?.ingresadosHoy ?? 0)} delta={`${kpis?.total ?? 0} total`} />
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12 },
  gridCollapsed: { flexDirection: 'column' },
});