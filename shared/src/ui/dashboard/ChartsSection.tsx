// RF-16 — Sección de gráficas de evolución + predicciones + patrones
import * as React from 'react';
import { View } from 'react-native';
import { AreaEvolucion } from '../charts/AreaEvolucion.js';
import { PrediccionPicos } from '../charts/PrediccionPicos.js';
import { PatronesCategoria } from '../charts/PatronesCategoria.js';
import { PrecisionIa } from '../charts/PrecisionIa.js';
import type { PronosticoDia, MetricaIaFuente } from '../../dashboard.js';

type Props = {
  evolucion: { dia: string; mesaId: number; count: number }[];
  mesas: { id: number; nombre: string }[];
  picos: any[];
  picosResumen: any[];
  pronosticoML: PronosticoDia[];
  patrones: any[];
  metricasIa: MetricaIaFuente[];
};

export function ChartsSection({ evolucion, mesas, picos, picosResumen, pronosticoML, patrones, metricasIa }: Props) {
  return (
    <View style={{ gap: 12 }}>
      <AreaEvolucion data={evolucion} mesas={mesas} />
      <PrediccionPicos picos={picos} resumen={picosResumen} ml={pronosticoML} />
      <PatronesCategoria data={patrones} />
      <PrecisionIa data={metricasIa} />
    </View>
  );
}