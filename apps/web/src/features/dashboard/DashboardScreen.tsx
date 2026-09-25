// Dashboard — Stitch 2560×2048 acoplado a Supabase (RF-16/17/21/24)
import * as React from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FilterBar, theme, getKPIs, getStatsPorEstado, getStatsPorPrioridad, getEvolucionPorMesa, getCargaHoraria, listAlertasIA, generarAlertasIA, marcarAlertaIA, fetchMesas, getPicosPrediccion, getPicosResumen, getPronosticoSemanal, getPatronesCategoria, getMesaIdPorDominio, fetchTicketsFiltrados, ticketsToRows, toCsvWithMeta, buildExportFilename, downloadCsv, getMetricasIaFeedback, isEstadoTicket, isPrioridadTicket, type Mesa, type DashboardFilters, type FilterRange, type PronosticoDia, type MetricaIaFuente, type Kpis, type StatsEstado, type StatsPrioridad, type EvolucionPunto, type CargaCelda, type PicoPrediccion, type PicosResumen, type PatronCategoria, type AlertaIA, useFeedback } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { reportError } from '../../lib/sentry';
import { exportTablePdf, exportTablePng, type ExportTable } from '../../lib/exportTable';
import { KpiRow } from '@helpdesk/shared';
import { EstadoPrioridadRow } from '@helpdesk/shared';
import { ChartsSection } from '@helpdesk/shared';
import { CargaAlertasSection } from '@helpdesk/shared';

export function DashboardScreen() {
  const fb = useFeedback();
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  const [range, setRange] = React.useState<FilterRange>('30d');
  const [customDesde, setCustomDesde] = React.useState('');
  const [customHasta, setCustomHasta] = React.useState('');
  const [mesaIds, setMesaIds] = React.useState<number[]>([]);
  const [mesas, setMesas] = React.useState<Mesa[]>([]);
  const [categorias, setCategorias] = React.useState<{ id: number; nombre: string; dominio: string }[]>([]);
  const [tecnicos, setTecnicos] = React.useState<{ id: string; nombre: string }[]>([]);
  const [estado, setEstado] = React.useState('');
  const [prioridad, setPrioridad] = React.useState('');
  const [categoriaId, setCategoriaId] = React.useState<number | ''>('');
  const [tecnicoId, setTecnicoId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [kpis, setKpis] = React.useState<Kpis | null>(null);
  const [porEstado, setPorEstado] = React.useState<StatsEstado>([]);
  const [porPrioridad, setPorPrioridad] = React.useState<StatsPrioridad>([]);
  const [evolucion, setEvolucion] = React.useState<EvolucionPunto[]>([]);
  const [carga, setCarga] = React.useState<CargaCelda[]>([]);
  const [picos, setPicos] = React.useState<PicoPrediccion[]>([]);
  const [picosResumen, setPicosResumen] = React.useState<PicosResumen[]>([]);
  const [pronosticoML, setPronosticoML] = React.useState<PronosticoDia[]>([]);
  // Telemetría IA — precisión validada por fuente (vista metricas_ia_feedback)
  const [metricasIa, setMetricasIa] = React.useState<MetricaIaFuente[]>([]);
  const [patrones, setPatrones] = React.useState<PatronCategoria[]>([]);
  const [alertas, setAlertas] = React.useState<AlertaIA[]>([]);
  const [generandoAlertas, setGenerandoAlertas] = React.useState(false);

  const filters: DashboardFilters = React.useMemo(() => {
    const f: DashboardFilters = {};
    if (mesaIds.length) f.mesaIds = mesaIds;
    if (categoriaId !== '') f.categoriaId = categoriaId;
    if (estado && isEstadoTicket(estado)) f.estado = estado;
    if (prioridad && isPrioridadTicket(prioridad)) f.prioridad = prioridad;
    if (tecnicoId) f.tecnicoId = tecnicoId;
    const now = new Date();
    if (range === 'hoy') f.desde = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    else if (range === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); f.desde = d.toISOString(); }
    else if (range === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); f.desde = d.toISOString(); }
    else if (range === 'custom') {
      if (customDesde) f.desde = new Date(customDesde).toISOString();
      if (customHasta) { const h = new Date(customHasta); h.setHours(23, 59, 59, 999); f.hasta = h.toISOString(); }
    }
    return f;
  }, [range, mesaIds, categoriaId, estado, prioridad, tecnicoId, customDesde, customHasta]);

  const load = React.useCallback(async () => {
    try {
      const [k, e, p, ev, c, pp, pr, pat, a, ms, ml, mia] = await Promise.all([
        getKPIs(supabase, filters),
        getStatsPorEstado(supabase, filters),
        getStatsPorPrioridad(supabase, filters),
        getEvolucionPorMesa(supabase, { ...filters, dias: 30 }),
        getCargaHoraria(supabase, filters),
        getPicosPrediccion(supabase, { ...filters, dias: 30 }),
        getPicosResumen(supabase, { ...filters, dias: 30 }),
        getPatronesCategoria(supabase, { ...filters, dias: 30 }),
        listAlertasIA(supabase, { estado: 'nueva' }),
        mesas.length ? Promise.resolve(mesas) : fetchMesas(supabase),
        getPronosticoSemanal(supabase),
        getMetricasIaFeedback(supabase),
      ]);
      setKpis(k); setPorEstado(e); setPorPrioridad(p); setEvolucion(ev); setCarga(c); setPicos(pp); setPicosResumen(pr); setPatrones(pat); setAlertas(a); setPronosticoML(ml); setMetricasIa(mia);
      if (!mesas.length) setMesas(ms);
    } catch (err) {
      reportError(err, { flujo: 'dashboard-load' });
    } finally { setLoading(false); setRefreshing(false); }
  }, [filters, mesas.length]);

  React.useEffect(() => { setLoading(true); load(); }, [load]);
  React.useEffect(() => {
    const ch = supabase.channel('dashboard-tickets').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  React.useEffect(() => {
    fetchMesas(supabase).then(setMesas).catch((err) => reportError(err, { flujo: 'dashboard-mesas' }));
    type CategoriaRow = { id: number; subcategoria: string | null; dominio: string };
    type PerfilRow = { id: string; full_name: string | null; email?: string | null };
    supabase.from('ticket_categories').select('id,subcategoria,dominio').eq('activa', true).order('subcategoria').then(({ data, error }) => {
      if (error) { reportError(error, { flujo: 'dashboard-categorias' }); return; }
      const rows = (data ?? []) as unknown as CategoriaRow[];
      setCategorias(rows.map((c) => ({ id: c.id, nombre: c.subcategoria ?? String(c.id), dominio: c.dominio })));
    });
    supabase.from('profiles').select('id,full_name,rol').in('rol', ['tecnico', 'jefe']).eq('activo', true).order('full_name').then(({ data, error }) => {
      if (error) { reportError(error, { flujo: 'dashboard-tecnicos' }); return; }
      const rows = (data ?? []) as unknown as PerfilRow[];
      setTecnicos(rows.map((u) => ({ id: u.id, nombre: u.full_name ?? u.email ?? u.id })));
    });
  }, []);

  const onToggleMesa = (id: number) => setMesaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  React.useEffect(() => {
    if (categoriaId !== '' && mesaIds.length) {
      const cat = categorias.find((c) => c.id === categoriaId);
      if (cat && cat.dominio && typeof cat.dominio === 'string') {
        if (getMesaIdPorDominio(cat.dominio) !== mesaIds[0]) setCategoriaId('');
      }
    }
  }, [mesaIds, categorias, categoriaId]);
  const onExport = React.useCallback(async () => {
    try {
      const data = await fetchTicketsFiltrados(supabase, filters, 2000);
      const mesaName = (id: number | null) => mesas.find((m) => m.id === id)?.nombre ?? String(id ?? '—');
      const categoriaName = (id: number) => categorias.find((c) => c.id === id)?.nombre ?? String(id);
      const tecnicoName = (id: string) => tecnicos.find((t) => t.id === id)?.nombre ?? id;
      const rows = ticketsToRows(data ?? [], mesaName);
      const csv = toCsvWithMeta(rows, filters, { mesaName, categoriaName, tecnicoName });
      const ok = downloadCsv(buildExportFilename('dashboard', 'csv'), csv);
      if (ok) fb.show('CSV listo', `Se generaron ${rows.length} filas.`, 'success');
      else if (typeof window !== 'undefined') fb.show('CSV generado', `Se generaron ${rows.length} filas. Copia desde consola.`, 'info');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al exportar CSV';
      reportError(e, { flujo: 'dashboard-export-csv' });
      fb.show('Error al exportar', msg, 'error');
    }
  }, [filters, mesas, categorias, tecnicos]);
  // Tabla de datos filtrados para PNG/PDF basados en datos (fallback del screenshot)
  const fetchExportTable = React.useCallback(async (): Promise<ExportTable> => {
    const data = await fetchTicketsFiltrados(supabase, filters, 2000);
    const mesaName = (id: number | null) => mesas.find((m) => m.id === id)?.nombre ?? String(id ?? '—');
    const categoriaName = (id: number) => categorias.find((c) => c.id === id)?.nombre ?? String(id);
    const tecnicoName = (id: string) => tecnicos.find((t) => t.id === id)?.nombre ?? id;
    const rows = ticketsToRows(data ?? [], mesaName);
    return {
      title: 'Tablero de tickets',
      subtitle: (await import('@helpdesk/shared')).formatFiltrosResumen(filters, { mesaName, categoriaName, tecnicoName }),
      header: ['numero', 'asunto', 'estado', 'prioridad', 'mesa', 'categoria', 'creado', 'actualizado'],
      rows: rows.map((r) => [r.numero, r.asunto, r.estado, r.prioridad, r.mesa, r.categoria, r.creado, r.actualizado]),
    };
  }, [filters, mesas, categorias, tecnicos]);

  const onExportPng = React.useCallback(async () => {
    try {
      if (Platform.OS !== 'web' || typeof document === 'undefined') { fb.show('No disponible', 'Exportar PNG solo disponible en web', 'warning'); return; }
      const el = document.getElementById('dashboard-export-root') as HTMLElement | null;
      if (el) {
        try {
          const html2canvas = await import('html2canvas');
          const render = html2canvas.default as unknown as (el: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>;
          const canvas = await render(el, { backgroundColor: '#F8FAFC', scale: 1, useCORS: true, logging: false });
          const url = canvas.toDataURL('image/png');
          // Las gráficas SVG no siempre las rasteriza html2canvas → si sale vacío, fallback a tabla de datos
          if (canvas.width > 0 && canvas.height > 0 && url.length > 4000) {
            const a = document.createElement('a'); a.href = url; a.download = (await import('@helpdesk/shared')).buildExportFilename('dashboard', 'png'); a.click();
            return;
          }
        } catch (e) { reportError(e, { flujo: 'dashboard-export-png-shot' }); }
      }
      // Fallback basado en datos (nunca sale vacío)
      const table = await fetchExportTable();
      const { count } = await exportTablePng('dashboard', table);
      fb.show('PNG listo', `El tablero como imagen no se pudo capturar; se exportó la tabla con ${count} filas.`, 'success');
    } catch (e: unknown) { reportError(e, { flujo: 'dashboard-export-png' }); fb.show('Error al exportar', 'Error al exportar PNG', 'error'); }
  }, [fb, filters, mesas, categorias, tecnicos]);
  const onExportPdf = React.useCallback(async () => {
    try {
      if (Platform.OS !== 'web' || typeof document === 'undefined') { fb.show('No disponible', 'Exportar PDF solo disponible en web', 'warning'); return; }
      // PDF siempre desde datos (texto real, paginado): el screenshot de gráficas suele salir vacío
      const table = await fetchExportTable();
      const { count } = exportTablePdf('dashboard', table);
      fb.show('PDF listo', `Se generaron ${count} filas (dataset completo).`, 'success');
    } catch (e: unknown) { reportError(e, { flujo: 'dashboard-export-pdf' }); fb.show('Error al exportar', 'Error al exportar PDF', 'error'); }
  }, [fb, filters, mesas, categorias, tecnicos]);
  const onGenerarAlertas = React.useCallback(async () => {
    setGenerandoAlertas(true);
    try { await generarAlertasIA(supabase); const a = await listAlertasIA(supabase, { estado: 'nueva' }); setAlertas(a); } catch(e: unknown){ reportError(e, { flujo: 'dashboard-generar-alertas' }); } finally { setGenerandoAlertas(false); }
  }, []);
  const onMarcarAlerta = React.useCallback(async (id:number, estado:'vista'|'resuelta')=>{ try{ await marcarAlertaIA(supabase, id, estado); setAlertas(prev=>prev.filter(a=>a.id!==id)); }catch(e: unknown){ reportError(e, { flujo: 'dashboard-marcar-alerta' });} },[]);

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={s.loadingText}>Cargando tablero…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FilterBar
        range={range} onRangeChange={setRange}
        mesaIds={mesaIds} onToggleMesa={onToggleMesa} mesas={mesas}
        estado={estado} onEstadoChange={setEstado}
        prioridad={prioridad} onPrioridadChange={setPrioridad}
        categoriaId={categoriaId} onCategoriaChange={setCategoriaId} categorias={categorias}
        tecnicoId={tecnicoId} onTecnicoChange={setTecnicoId} tecnicos={tecnicos}
        customDesde={customDesde} customHasta={customHasta} onCustomDesdeChange={setCustomDesde} onCustomHastaChange={setCustomHasta}
        onExport={onExport}
        onExportPng={onExportPng}
        onExportPdf={onExportPdf}
      />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />} contentContainerStyle={{ padding: 16 }} style={{ flex: 1 }}>
        <View nativeID="dashboard-export-root">
          <KpiRow kpis={kpis} isWide={isWide} />
          <EstadoPrioridadRow porEstado={porEstado} porPrioridad={porPrioridad} isWide={isWide} />
          <ChartsSection evolucion={evolucion} mesas={mesas} picos={picos} picosResumen={picosResumen} pronosticoML={pronosticoML} patrones={patrones} metricasIa={metricasIa} />
          <CargaAlertasSection carga={carga} alertas={alertas} generandoAlertas={generandoAlertas} onGenerarAlertas={onGenerarAlertas} onMarcarAlerta={onMarcarAlerta} />
        </View>
      </ScrollView>
      {fb.modal}
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.bg },
  loadingText: { color: theme.colors.muted, fontSize: 12 },
  footerLink: { fontSize: 11, color: theme.colors.muted, textAlign: 'center', marginTop: 12, textDecorationLine: 'underline' },
});