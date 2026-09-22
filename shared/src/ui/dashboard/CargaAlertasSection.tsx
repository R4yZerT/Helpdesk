// RF-16 — Sección de carga horaria + alertas IA
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { HeatmapCarga } from '../charts/HeatmapCarga.js';
import { TimelineAlertas } from '../charts/TimelineAlertas.js';
import type { CargaCelda } from '../../dashboard.js';

type Props = {
  carga: CargaCelda[];
  alertas: { id: number; tipo: string; mensaje: string; severidad: string; estado: string; creadoEn: string; mesaId: number | null }[];
  generandoAlertas: boolean;
  onGenerarAlertas: () => void;
  onMarcarAlerta: (id: number, estado: 'vista' | 'resuelta') => void;
};

export function CargaAlertasSection({ carga, alertas, generandoAlertas, onGenerarAlertas, onMarcarAlerta }: Props) {
  return (
    <View style={[s.twoCol, s.sectionTop]}>
      <View style={{ flex: 7 }}><HeatmapCarga data={carga} /></View>
      <View style={{ flex: 5 }}>
        <Pressable onPress={onGenerarAlertas} disabled={generandoAlertas} style={{ backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginBottom: 8, opacity: generandoAlertas ? 0.6 : 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{generandoAlertas ? 'Generando…' : 'Generar alertas (IA)'}</Text>
        </Pressable>
        <TimelineAlertas alertas={alertas} onVista={(id) => onMarcarAlerta(id, 'vista')} onResuelta={(id) => onMarcarAlerta(id, 'resuelta')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  twoCol: { flexDirection: 'row', gap: 12 },
  sectionTop: { marginTop: 4 },
});