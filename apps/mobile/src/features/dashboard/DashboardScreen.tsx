// Dashboard — Stitch 2560×2048 acoplado a Supabase (RF-16/17/21/24)
import * as React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppShell, FilterBar, Sidebar, TopBar, theme, getKPIs, getStatsPorEstado, getStatsPorPrioridad, getEvolucionPorMesa, getCargaHoraria, listAlertasIA, fetchMesas, KpiCard, DonutEstado, BarsPrioridad, AreaEvolucion, HeatmapCarga, TimelineAlertas, type DashboardFilters, type FilterRange, ticketsToRows, toCsv, downloadCsv } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function DashboardScreen() {
  const { profile, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  const [range, setRange] = React.useState<FilterRange>('30d');
  const [mesaIds, setMesaIds] = React.useState<number[]>([]);
  const [mesas, setMesas] = React.useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [kpis, setKpis] = React.useState<any>(null);
  const [porEstado, setPorEstado] = React.useState<any[]>([]);
  const [porPrioridad, setPorPrioridad] = React.useState<any[]>([]);
  const [evolucion, setEvolucion] = React.useState<any[]>([]);
  const [carga, setCarga] = React.useState<any[]>([]);
  const [alertas, setAlertas] = React.useState<any[]>([]);

  const filters: DashboardFilters = React.useMemo(() => {
    const f: DashboardFilters = {};
    if (mesaIds.length) f.mesaIds = mesaIds;
    const now = new Date();
    if (range === 'hoy') f.desde = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    else if (range === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); f.desde = d.toISOString(); }
    else if (range === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); f.desde = d.toISOString(); }
    return f;
  }, [range, mesaIds]);

  const load = React.useCallback(async () => {
    try {
      const [k, e, p, ev, c, a, ms] = await Promise.all([
        getKPIs(supabase, filters),
        getStatsPorEstado(supabase, filters),
        getStatsPorPrioridad(supabase, filters),
        getEvolucionPorMesa(supabase, { ...filters, dias: 30 }),
        getCargaHoraria(supabase, filters),
        listAlertasIA(supabase, { estado: 'nueva' }),
        mesas.length ? Promise.resolve(mesas) : fetchMesas(supabase),
      ]);
      setKpis(k); setPorEstado(e); setPorPrioridad(p); setEvolucion(ev); setCarga(c); setAlertas(a);
      if (!mesas.length) setMesas(ms as any);
    } catch (err) {
      console.warn('[Dashboard] load', err);
    } finally { setLoading(false); setRefreshing(false); }
  }, [filters, mesas.length]);

  React.useEffect(() => { setLoading(true); load(); }, [load]);
  React.useEffect(() => { // initial mesas
    fetchMesas(supabase).then(setMesas).catch(() => {});
  }, []);

  const onToggleMesa = (id: number) => setMesaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const onExport = React.useCallback(async () => {
    try {
      let q: any = supabase.from('tickets').select('numero,asunto,estado,prioridad,mesa_id,categoria_id,creado_en,actualizado_en').order('creado_en', { ascending: false }).limit(2000);
      if (filters.desde) q = q.gte('creado_en', filters.desde);
      if (filters.hasta) q = q.lte('creado_en', filters.hasta);
      if (filters.mesaIds?.length) q = q.in('mesa_id', filters.mesaIds);
      const { data, error } = await q;
      if (error) throw error;
      const mesaName = (id: number | null) => mesas.find((m) => m.id === id)?.nombre ?? String(id ?? '—');
      const rows = ticketsToRows((data as any) ?? [], mesaName);
      const csv = toCsv(rows);
      downloadCsv(`dashboard-${new Date().toISOString().slice(0,10)}.csv`, csv);
    } catch (e) { console.warn('[Dashboard] export', e); }
  }, [filters, mesas]);

  const sidebar = (
    <Sidebar
      items={[
        { id: 'dash', label: 'Dashboard', active: true },
        { id: 'bandeja', label: 'Bandeja' },
        { id: 'reportes', label: 'Reportes' },
        { id: 'alertas', label: `Alertas IA${alertas.length ? ` · ${alertas.length}` : ''}` },
      ]}
      user={profile ? { name: profile.nombre ?? profile.email ?? 'Usuario', role: profile.rol } : undefined}
      onLogout={signOut}
    />
  );

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={s.loadingText}>Cargando tablero…</Text>
      </View>
    );
  }

  const kpiGrid = (
    <View style={[s.kpiGrid, !isWide && { flexDirection: 'column' }]}>
      <KpiCard label="Tickets abiertos" value={String(kpis?.abiertos ?? 0)} delta="+12% vs ayer" />
      <KpiCard label="SLA en riesgo" value={String(kpis?.slaRiesgo ?? 0)} delta="<45 min" deltaTone="warn" accent="orange" />
      <KpiCard label="Tiempo medio" value={`${kpis?.ttrHoras ?? 4.2}h`} delta="-0.3h" />
      <KpiCard label="Ingresados hoy" value={String(kpis?.ingresadosHoy ?? 0)} delta={`${kpis?.total ?? 0} total`} />
    </View>
  );

  const content = (
    <View style={s.content}>
      {kpiGrid}
      <View style={[s.twoCol, !isWide && { flexDirection: 'column' }]}>
        <View style={{ flex: 7 }}><DonutEstado data={porEstado} /></View>
        <View style={{ flex: 5 }}><BarsPrioridad data={porPrioridad} /></View>
      </View>
      <AreaEvolucion data={evolucion} mesas={mesas} />
      <View style={[s.twoCol, !isWide && { flexDirection: 'column' }]}>
        <View style={{ flex: 7 }}><HeatmapCarga data={carga} /></View>
        <View style={{ flex: 5 }}><TimelineAlertas alertas={alertas} /></View>
      </View>
    </View>
  );

  return (
    <AppShell
      sidebar={sidebar}
      topBar={<TopBar />}
      filterBar={<FilterBar range={range} onRangeChange={setRange} mesaIds={mesaIds} onToggleMesa={onToggleMesa} mesas={mesas} onExport={onExport} />}
    >
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}>
        {content}
      </ScrollView>
    </AppShell>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.bg },
  loadingText: { color: theme.colors.muted, fontSize: 12 },
  kpiGrid: { flexDirection: 'row', gap: 12 },
  twoCol: { flexDirection: 'row', gap: 12 },
  content: { gap: 12 },
  footerLink: { fontSize: 11, color: theme.colors.muted, textAlign: 'center', marginTop: 12, textDecorationLine: 'underline' },
});
