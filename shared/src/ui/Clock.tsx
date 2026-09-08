// Clock — reloj 12h am/pm en esquina superior derecha
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from './theme.js';
import { IconClock } from './icons.js';

function format12h(d: Date): string {
  return d.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function Clock({ size = 14, color = theme.colors.muted, iconColor = theme.colors.muted }: { size?: number; color?: string; iconColor?: string }) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    // alinea al siguiente minuto para no esperar 60s desfase
    const msToNextMin = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    const t = setTimeout(() => setNow(new Date()), msToNextMin);
    return () => { clearInterval(id); clearTimeout(t); };
  }, []);
  return (
    <View style={s.wrap} accessibilityLabel={`Hora actual ${format12h(now)}`}>
      <IconClock size={size} color={iconColor} />
      <Text style={[s.text, { color, fontSize: size - 1 }]}>{format12h(now)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontWeight: '700', fontVariant: ['tabular-nums'] as never, letterSpacing: 0.2 },
});
