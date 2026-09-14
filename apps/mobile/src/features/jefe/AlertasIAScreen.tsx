// RF-24 móvil — Alertas IA dirigidas al jefe: lista, genera y resuelve.
// Reutiliza helpers shared (dashboard.ts) y TimelineAlertas.
import * as React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme, listAlertasIA, generarAlertasIA, marcarAlertaIA, TimelineAlertas, type AlertaIA } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';

export function AlertasIAScreen() {
  const [alertas, setAlertas] = React.useState<AlertaIA[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [generando, setGenerando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const a = await listAlertasIA(supabase, { estado: 'nueva' });
      setAlertas(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar alertas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const onGenerar = React.useCallback(async () => {
    setGenerando(true);
    try {
      await generarAlertasIA(supabase as never);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar alertas');
    } finally {
      setGenerando(false);
    }
  }, [load]);

  const onMarcar = React.useCallback(async (id: number, estado: 'vista' | 'resuelta') => {
    try {
      await marcarAlertaIA(supabase as never, id, estado);
      setAlertas((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar alerta');
    }
  }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={s.muted}>Cargando alertas IA…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
    >
      <View style={s.header}>
        <Text style={s.h1}>Alertas IA</Text>
        <Pressable onPress={onGenerar} disabled={generando} style={[s.btnPrimary, generando && { opacity: 0.6 }]}>
          <Text style={s.btnPrimaryText}>{generando ? 'Generando…' : 'Generar alertas'}</Text>
        </Pressable>
      </View>
      <Text style={s.subtitle}>Anomalías, picos inusuales y tickets estancados (RF-21/RF-24).</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <TimelineAlertas
        alertas={alertas}
        onVista={(id) => onMarcar(id, 'vista')}
        onResuelta={(id) => onMarcar(id, 'resuelta')}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.bg },
  muted: { fontSize: 12, color: theme.colors.muted },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  h1: { fontSize: 20, fontWeight: '800', color: theme.colors.text, flex: 1 },
  subtitle: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  error: { fontSize: 12, color: theme.colors.danger, fontWeight: '600' },
  btnPrimary: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
