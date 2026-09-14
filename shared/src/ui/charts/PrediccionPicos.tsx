// RF-19 — Predicción de picos: top slots (dow×hour×mesa) + resumen por mesa
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';
import type { PicoPrediccion, PicosResumen } from '../../dashboard.js';

const DOW = ['Lun','Mar','Mié','Jue','Vie'];
const NIVEL_COLOR: Record<string,string> = { baja:'#EEF2F7', media:'#A0CAFF', alta:theme.colors.primary, pico:theme.colors.accent };

export function PrediccionPicos({ picos, resumen }: { picos: PicoPrediccion[]; resumen: PicosResumen[] }) {
  const top = picos.filter(p=>p.esPico).slice(0,8);
  if (!picos.length && !resumen.length) return (
    <Card><Text style={s.title}>Predicción de picos (RF-19) — sin datos</Text><Text style={s.muted}>No hay historial suficiente (30d) para predecir.</Text></Card>
  );
  return (
    <Card style={{ gap: 10 }}>
      <Text style={s.title}>Predicción de picos · próxima ventana (RF-19)</Text>
      <Text style={s.muted}>Top franja horaria con mayor demanda prevista (promedio histórico × estacionalidad). Nivel alta/picos destacados.</Text>
      {top.length>0 && (
        <View style={{ gap: 6 }}>
          {top.map((p,i)=>(
            <View key={`${p.dow}-${p.hour}-${p.mesaId}-${i}`} style={[s.row, { backgroundColor: NIVEL_COLOR[p.nivel]??'#EEF2F7' }]}>
              <Text style={s.cellMesa}>{p.mesaNombre ?? (p.mesaId!=null?`Mesa ${p.mesaId}`:'Global')}</Text>
              <Text style={s.cellSlot}>{DOW[p.dow] ?? `d${p.dow}`} {String(p.hour).padStart(2,'0')}:00</Text>
              <Text style={s.cellVal}>{p.forecastCnt.toFixed(1)}/h</Text>
              <View style={[s.badge, { backgroundColor: p.nivel==='pico'? theme.colors.accent : theme.colors.primary }]}><Text style={s.badgeT}>{p.nivel.toUpperCase()}</Text></View>
            </View>
          ))}
        </View>
      )}
      {resumen.length>0 && (
        <>
          <Text style={[s.title,{marginTop:4}]}>Forecast por mesa</Text>
          <View style={{ gap: 4 }}>
            <View style={[s.row,s.headerRow]}><Text style={[s.cellMesa,{fontWeight:'800'}]}>Mesa</Text><Text style={s.cellSlot}>Pico</Text><Text style={s.cellVal}>/día</Text><Text style={s.cellVal}>7d</Text><Text style={s.cellVal}>30d</Text></View>
            {resumen.slice(0,6).map((r)=>(
              <View key={String(r.mesaId)} style={[s.row,{backgroundColor:'#F8FAFC'}]}>
                <Text style={s.cellMesa} numberOfLines={1}>{r.mesaNombre ?? (r.mesaId!=null?`Mesa ${r.mesaId}`:'—')}</Text>
                <Text style={s.cellSlot}>{r.peakDow!=null && r.peakHour!=null ? `${DOW[r.peakDow]??r.peakDow} ${r.peakHour}:00` : '—'}</Text>
                <Text style={s.cellVal}>{r.avgDia.toFixed(1)}</Text>
                <Text style={s.cellVal}>{r.forecast7d}</Text>
                <Text style={s.cellVal}>{r.forecast30d}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {!top.length && <Text style={s.muted}>Sin franjas en nivel alta/pico — carga distribuida.</Text>}
    </Card>
  );
}
const s = StyleSheet.create({
  title:{fontSize:13,fontWeight:'800',color:theme.colors.text},
  muted:{fontSize:11,color:theme.colors.muted},
  row:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:6,paddingHorizontal:8,borderRadius:8,borderWidth:1,borderColor:'rgba(226,232,240,0.8)'},
  headerRow:{backgroundColor:'#EEF2F7',borderStyle:'dashed'},
  cellMesa:{flex:1.2,fontSize:11,fontWeight:'700',color:theme.colors.text},
  cellSlot:{flex:1,fontSize:11,color:theme.colors.muted},
  cellVal:{width:54,textAlign:'right',fontSize:11,fontWeight:'700',color:theme.colors.text},
  badge:{paddingHorizontal:6,paddingVertical:2,borderRadius:999},
  badgeT:{fontSize:9,fontWeight:'800',color:'#fff'},
});
