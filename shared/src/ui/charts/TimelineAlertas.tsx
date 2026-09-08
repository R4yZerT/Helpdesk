// TimelineAlertas — Stitch border-l-3 #FD7C06 + badge pulse + confianza
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { Card, Badge } from '../components.js';

type Alerta = { id: number; tipo: string; mensaje: string; severidad: string; estado: string; creadoEn: string; mesaId?: number | null };

export function TimelineAlertas({ alertas, onVista, onResuelta }: { alertas: Alerta[]; onVista?: (id:number)=>void; onResuelta?: (id:number)=>void }) {
  if (!alertas.length) {
    return (
      <Card style={{ gap: 8 }}>
        <Text style={s.title}>Alertas & Predicciones IA</Text>
        <Text style={s.empty}>Sin alertas activas — todo estable.</Text>
      </Card>
    );
  }
  return (
    <Card style={{ gap: 12 }}>
      <View style={s.head}>
        <Text style={s.title}>Alertas & Predicciones IA</Text>
        <Badge label={`${alertas.length} nuevas`} tone="accent" />
      </View>
      {alertas.slice(0, 5).map((a) => (
        <View key={a.id} style={[s.item, a.severidad === 'critica' || a.severidad === 'alta' ? s.itemUrgent : null]}>
          <View style={s.itemHead}>
            <Text style={s.tipo}>{a.tipo.replace('_', ' ')}</Text>
            <Badge label={a.severidad} tone={a.severidad === 'critica' ? 'accent' : a.severidad === 'alta' ? 'danger' : 'warning'} />
          </View>
          <Text style={s.mensaje}>{a.mensaje}</Text>
          <Text style={s.meta}>{new Date(a.creadoEn).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · Modelo v2</Text>
          {(onVista || onResuelta) ? <View style={s.actions}><Text onPress={()=>onVista?.(a.id)} style={s.actionLink}>Marcar vista</Text><Text onPress={()=>onResuelta?.(a.id)} style={s.actionLinkRes}>Resolver</Text></View> : null}
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
  empty: { fontSize: 12, color: theme.colors.muted },
  item: { backgroundColor: theme.colors.bg, borderRadius: 12, padding: 12, gap: 6, borderLeftWidth: 3, borderLeftColor: theme.colors.border },
  itemUrgent: { borderLeftColor: theme.colors.accent, backgroundColor: theme.colors.orange50 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipo: { fontSize: 10, fontWeight: '700', color: theme.colors.mutedSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  mensaje: { fontSize: 12, fontWeight: '600', color: theme.colors.text, lineHeight: 16 },
  meta: { fontSize: 10, color: theme.colors.mutedSoft },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionLink: { fontSize: 11, color: theme.colors.primary, fontWeight: '700' },
  actionLinkRes: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
});
