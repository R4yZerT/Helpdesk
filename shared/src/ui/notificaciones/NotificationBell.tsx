// RF-23 — Campana notificaciones (in-app + expo-notifications)
// Muestra badge no leídas, lista dropdown, realtime y marca leída
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import { countNoLeidas, listNotificaciones, marcarLeida, marcarTodasLeidas, subscribeNotificaciones, type Notificacion } from '../../notificaciones.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export function NotificationBell({ client, onOpenTicket }: { client: SupabaseClient; onOpenTicket?: (ticketId: string) => void }) {
  const [count, setCount] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Notificacion[]>([]);

  const refresh = React.useCallback(async () => {
    try {
      const [c, list] = await Promise.all([countNoLeidas(client), listNotificaciones(client, { limit: 12 })]);
      setCount(c);
      setItems(list);
    } catch {}
  }, [client]);

  React.useEffect(() => {
    refresh();
    const unsub = subscribeNotificaciones(client, (n) => {
      // Solo cuenta si es para el usuario actual (RLS ya filtra, pero por si acaso)
      setItems((prev) => [n, ...prev].slice(0, 12));
      setCount((c) => c + 1);
      // Opcional: vibrar / sonido web
      try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) (navigator as any).vibrate?.(100); } catch {}
    });
    // Poll fallback cada 60s por si realtime no conecta
    const id = setInterval(refresh, 60000);
    return () => { unsub(); clearInterval(id); };
  }, [client, refresh]);

  const onToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  };

  const onMarkOne = async (id: number) => {
    await marcarLeida(client, id);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, leida: true } : x)));
    setCount((c) => Math.max(0, c - 1));
  };
  const onMarkAll = async () => {
    await marcarTodasLeidas(client);
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
    setCount(0);
  };

  return (
    <View style={s.wrap}>
      <Pressable onPress={onToggle} style={s.bell} accessibilityLabel={`Notificaciones ${count ? count + ' nuevas' : 'sin nuevas'}`} accessibilityRole="button">
        <Text style={s.icon}>🔔</Text>
        {count > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
          </View>
        ) : null}
      </Pressable>
      {open ? (
        <View style={s.dropdown}>
          <View style={s.head}>
            <Text style={s.headTitle}>Notificaciones</Text>
            <Pressable onPress={onMarkAll} style={s.markAll}><Text style={s.markAllText}>Marcar todas leídas</Text></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {items.length === 0 ? (
              <Text style={s.empty}>Sin notificaciones</Text>
            ) : (
              items.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => {
                    if (!n.leida) onMarkOne(n.id);
                    if (n.ticket_id && onOpenTicket) onOpenTicket(n.ticket_id);
                  }}
                  style={[s.item, !n.leida && s.itemUnread]}
                >
                  <Text style={[s.itemTitle, !n.leida && s.itemTitleUnread]} numberOfLines={1}>{n.titulo}</Text>
                  {n.cuerpo ? <Text style={s.itemBody} numberOfLines={2}>{n.cuerpo}</Text> : null}
                  <Text style={s.itemTime}>{new Date(n.creado_en).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
          <Pressable onPress={() => setOpen(false)} style={s.closeBtn}><Text style={s.closeText}>Cerrar</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative' },
  bell: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 16 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: theme.colors.danger ?? '#ef4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  dropdown: { position: 'absolute', top: 44, right: 0, width: 340, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 8, zIndex: 50, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } as any, elevation: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  markAll: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: theme.colors.primarySoft ?? '#eff6ff' },
  markAllText: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
  empty: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', paddingVertical: 20 },
  item: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  itemUnread: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  itemTitle: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
  itemTitleUnread: { fontWeight: '800' },
  itemBody: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  itemTime: { fontSize: 10, color: theme.colors.muted, marginTop: 4 },
  closeBtn: { alignItems: 'center', paddingVertical: 6 },
  closeText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
});
