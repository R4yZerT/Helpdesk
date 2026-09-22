// RF-16 — Sección de gráficas de estado/prioridad (Donut + Barras)
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { DonutEstado } from '../charts/DonutEstado.js';
import { BarsPrioridad } from '../charts/BarsPrioridad.js';

type Props = {
  porEstado: { estado: string; count: number }[];
  porPrioridad: { prioridad: string; count: number }[];
  isWide: boolean;
};

export function EstadoPrioridadRow({ porEstado, porPrioridad, isWide }: Props) {
  return (
    <View style={[s.twoCol, !isWide && s.twoColCollapsed]}>
      <View style={{ flex: 7 }}><DonutEstado data={porEstado} /></View>
      <View style={{ flex: 5 }}><BarsPrioridad data={porPrioridad} /></View>
    </View>
  );
}

const s = StyleSheet.create({
  twoCol: { flexDirection: 'row', gap: 12 },
  twoColCollapsed: { flexDirection: 'column' },
});