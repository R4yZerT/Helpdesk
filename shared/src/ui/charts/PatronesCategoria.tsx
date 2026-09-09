// RF-20 — Patrones de demanda por categoría normalizada (13 clases consolidadas)
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card } from '../components.js';
import type { PatronCategoria } from '../../dashboard.js';

const TEND_COLOR: Record<string,string> = { al_alza:'#DC2626', nueva_alta:'#EA580C', estable:'#64748B', a_la_baja:'#16A34A', sin_demanda:'#CBD5E1' };
const TEND_LABEL: Record<string,string> = { al_alza:'Al alza', nueva_alta:'Nueva', estable:'Estable', a_la_baja:'A la baja', sin_demanda:'Sin demanda' };

export function PatronesCategoria({ data }: { data: PatronCategoria[] }) {
  if (!data.length) return <Card><Text style={s.title}>Patrones por categoría (RF-20) — sin datos</Text></Card>;
  const max = Math.max(...data.map(d=>d.cntActual),1);
  return (
    <Card style={{ gap: 10 }}>
      <Text style={s.title}>Patrones de demanda por categoría (RF-20)</Text>
      <Text style={s.muted}>Share del periodo + variación vs periodo previo. Tendencia al alza/baja/nueva demanda.</Text>
      <View style={{ gap: 6 }}>
        {data.slice(0,12).map((r)=>(
          <View key={String(r.categoriaId)} style={s.row}>
            <View style={{ flex:1, gap:2 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <Text style={s.cat} numberOfLines={1}>{r.subcategoria}</Text>
                <View style={[s.tbadge,{ backgroundColor: TEND_COLOR[r.tendencia] ?? '#64748B'}]}><Text style={s.tbadgeT}>{TEND_LABEL[r.tendencia] ?? r.tendencia}</Text></View>
              </View>
              <Text style={s.dom}>#{r.dominio}</Text>
              <View style={s.barBg}><View style={[s.barFg,{ width:`${Math.max(4,(r.cntActual/max)*100)}%` }]} /></View>
            </View>
            <View style={{ alignItems:'flex-end', gap:2, minWidth:92 }}>
              <Text style={s.cnt}>{r.cntActual} <Text style={s.muted}>({r.sharePct}%)</Text></Text>
              <Text style={[s.vari, { color: r.variacionPct>10? '#DC2626' : r.variacionPct<-10? '#16A34A' : theme.colors.muted }]}>{r.variacionPct>0?'+':''}{r.variacionPct}% vs previo ({r.cntPrevio})</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}
const s = StyleSheet.create({
  title:{fontSize:13,fontWeight:'800',color:theme.colors.text},
  muted:{fontSize:11,color:theme.colors.muted},
  row:{ flexDirection:'row', alignItems:'center', gap:12, paddingVertical:6, paddingHorizontal:8, borderRadius:8, borderWidth:1, borderColor:'rgba(226,232,240,0.7)', backgroundColor:'#fff'},
  cat:{fontSize:12,fontWeight:'700',color:theme.colors.text, flexShrink:1},
  dom:{fontSize:10,color:theme.colors.mutedSoft},
  barBg:{height:6,borderRadius:999,backgroundColor:'#EEF2F7',overflow:'hidden',marginTop:2},
  barFg:{height:6,borderRadius:999,backgroundColor:theme.colors.primary},
  cnt:{fontSize:12,fontWeight:'800',color:theme.colors.text},
  vari:{fontSize:10,fontWeight:'700'},
  tbadge:{paddingHorizontal:6,paddingVertical:2,borderRadius:999},
  tbadgeT:{fontSize:9,fontWeight:'800',color:'#fff'},
});
