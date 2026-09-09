// Dashboard — Stitch 2560×2048 acoplado a Supabase (RF-16/17/21/24)
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FilterBar, theme, getMesaIdPorDominio, getKPIs, getStatsPorEstado, getStatsPorPrioridad, getEvolucionPorMesa, getCargaHoraria, listAlertasIA, generarAlertasIA, marcarAlertaIA, fetchMesas, fetchTicketsFiltrados, KpiCard, DonutEstado, BarsPrioridad, AreaEvolucion, HeatmapCarga, TimelineAlertas, type DashboardFilters, type FilterRange, ticketsToRows, toCsvWithMeta, downloadCsv, buildExportFilename } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

  const [range, setRange] = React.useState<FilterRange>('30d');
  const [customDesde, setCustomDesde] = React.useState('');
  const [customHasta, setCustomHasta] = React.useState('');
  const [mesaIds, setMesaIds] = React.useState<number[]>([]);
  const [mesas, setMesas] = React.useState<{ id: number; nombre: string }[]>([]);
  const [categorias, setCategorias] = React.useState<{ id: number; nombre: string; dominio: string }[]>([]);
  const [tecnicos, setTecnicos] = React.useState<{ id: string; nombre: string }[]>([]);
  const [estado, setEstado] = React.useState('');
  const [prioridad, setPrioridad] = React.useState('');
  const [categoriaId, setCategoriaId] = React.useState<number | ''>('');
  const [tecnicoId, setTecnicoId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [kpis, setKpis] = React.useState<any>(null);
  const [porEstado, setPorEstado] = React.useState<any[]>([]);
  const [porPrioridad, setPorPrioridad] = React.useState<any[]>([]);
  const [evolucion, setEvolucion] = React.useState<any[]>([]);
  const [carga, setCarga] = React.useState<any[]>([]);
  const [alertas, setAlertas] = React.useState<any[]>([]);
  const [generandoAlertas, setGenerandoAlertas] = React.useState(false);

  const filters: DashboardFilters = React.useMemo(() => {
    const f: DashboardFilters = {};
    if (mesaIds.length) f.mesaIds = mesaIds;
    if (categoriaId !== '') f.categoriaId = categoriaId as number;
    if (estado) f.estado = estado as any;
    if (prioridad) f.prioridad = prioridad as any;
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
  React.useEffect(() => { // initial mesas + categorías + técnicos
    fetchMesas(supabase).then(setMesas).catch(() => {});
    (supabase.from('ticket_categories').select('id,subcategoria,dominio').eq('activa', true).order('subcategoria') as any).then(({ data }: any) => {
      if (data) setCategorias(data.map((c: any) => ({ id: c.id, nombre: c.subcategoria ?? String(c.id), dominio: c.dominio })));
    }).catch(() => {});
    (supabase.from('profiles').select('id,full_name,rol').in('rol', ['tecnico', 'jefe']).eq('activo', true).order('full_name') as any).then(({ data }: any) => {
      if (data) setTecnicos(data.map((u: any) => ({ id: u.id, nombre: u.full_name ?? u.email ?? u.id })));
    }).catch(() => {});
  }, []);

  const onToggleMesa = (id: number) => setMesaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  React.useEffect(() => {
    if (categoriaId !== '' && mesaIds.length) {
      const cat = categorias.find((c) => c.id === categoriaId);
      if (cat && getMesaIdPorDominio(cat.dominio) !== mesaIds[0]) setCategoriaId('');
    }
  }, [mesaIds, categorias, categoriaId]);
  const onExport = React.useCallback(async () => {
    try {
      const data = await fetchTicketsFiltrados(supabase as any, filters, 2000);
      const mesaName = (id: number | null) => mesas.find((m) => m.id === id)?.nombre ?? String(id ?? '—');
      const categoriaName = (id: number) => categorias.find((c) => c.id === id)?.nombre ?? String(id);
      const tecnicoName = (id: string) => tecnicos.find((t) => t.id === id)?.nombre ?? id;
      const rows = ticketsToRows((data as any) ?? [], mesaName);
      const csv = toCsvWithMeta(rows, filters, { mesaName, categoriaName, tecnicoName });
      const ok = downloadCsv(buildExportFilename('dashboard', 'csv'), csv);
      if (!ok && typeof window !== 'undefined') window.alert(`CSV generado (${rows.length} filas). Copia desde consola.`);
    } catch (e: any) {
      console.warn('[Dashboard] export', e);
      if (typeof window !== 'undefined') window.alert(e?.message ?? 'Error al exportar CSV');
    }
  }, [filters, mesas, categorias, tecnicos]);
  const onExportPng = React.useCallback(async () => {
    try {
      if (Platform.OS !== 'web' || typeof document === 'undefined') { alert('Exportar PNG solo disponible en web'); return; }
      const el = document.getElementById('dashboard-export-root') as HTMLElement | null;
      if (!el) { alert('No se encontró el contenedor de gráficas'); return; }
      // html2canvas importado estático arriba — evita Cannot find module en Metro web
      const canvas = await (html2canvas as any)(el, { backgroundColor: '#F8FAFC', scale: 2, useCORS: true, logging: false });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = buildExportFilename('dashboard', 'png'); a.click();
    } catch (e: any) { console.warn('[Dashboard] export png', e); alert(e?.message ? `Error al exportar PNG: ${e.message}` : 'Error al exportar PNG'); }
  }, []);
  const onExportPdf = React.useCallback(async () => {
    try {
      if (Platform.OS !== 'web' || typeof document === 'undefined') { alert('Exportar PDF solo disponible en web'); return; }
      const el = document.getElementById('dashboard-export-root') as HTMLElement | null;
      if (!el) { alert('No se encontró el contenedor de gráficas'); return; }
      // html2canvas importado estático arriba — evita Cannot find module en Metro web
      // jsPDF importado estático arriba
      const canvas = await (html2canvas as any)(el, { backgroundColor: '#FFFFFF', scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(buildExportFilename('dashboard', 'pdf'));
    } catch (e: any) { console.warn('[Dashboard] export pdf', e); alert(e?.message ? `Error al exportar PDF: ${e.message}` : 'Error al exportar PDF'); }
  }, []);
  const onGenerarAlertas = React.useCallback(async () => {
    setGenerandoAlertas(true);
    try { await generarAlertasIA(supabase as any); const a = await listAlertasIA(supabase, { estado: 'nueva' }); setAlertas(a); } catch(e){ console.warn('[Dashboard] generar alertas', e); } finally { setGenerandoAlertas(false); }
  }, []);
  const onMarcarAlerta = React.useCallback(async (id:number, estado:'vista'|'resuelta')=>{ try{ await marcarAlertaIA(supabase as any, id, estado); setAlertas(prev=>prev.filter(a=>a.id!==id)); }catch(e){ console.warn('[Dashboard] marcar alerta', e);} },[]);

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={s.loadingText}>Cargando tablero…</Text>
      </View>
    );
  }

  const slaDelta = kpis ? (kpis.slaVencidos != null ? `${kpis.slaVencidos} vencidos · ${kpis.slaPorVencer ?? 0} por vencer` : kpis.slaRiesgo > 0 ? `${kpis.slaRiesgo} en riesgo` : 'Dentro de compromiso') : '<45 min';
  const kpiGrid = (
    <View style={[s.kpiGrid, !isWide && { flexDirection: 'column' }]}>
      <KpiCard label="Tickets abiertos" value={String(kpis?.abiertos ?? 0)} delta="+12% vs ayer" />
      <KpiCard label="SLA en riesgo" value={String(kpis?.slaRiesgo ?? 0)} delta={slaDelta} deltaTone={ (kpis?.slaVencidos ?? 0) > 0 ? 'danger' as any : (kpis?.slaRiesgo ?? 0) > 0 ? 'warn' as any : undefined } accent="orange" />
      <KpiCard label="Tiempo medio" value={`${kpis?.ttrHoras ?? 4.2}h`} delta="-0.3h" />
      <KpiCard label="Ingresados hoy" value={String(kpis?.ingresadosHoy ?? 0)} delta={`${kpis?.total ?? 0} total`} />
    </View>
  );

  const content = (
    <View nativeID="dashboard-export-root" style={s.content}>
      {kpiGrid}
      <View style={[s.twoCol, !isWide && { flexDirection: 'column' }]}>
        <View style={{ flex: 7 }}><DonutEstado data={porEstado} /></View>
        <View style={{ flex: 5 }}><BarsPrioridad data={porPrioridad} /></View>
      </View>
      <AreaEvolucion data={evolucion} mesas={mesas} />
      <View style={[s.twoCol, !isWide && { flexDirection: 'column' }]}>
        <View style={{ flex: 7 }}><HeatmapCarga data={carga} /></View>
        <View style={{ flex: 5 }}><Pressable onPress={onGenerarAlertas} disabled={generandoAlertas} style={{ backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginBottom: 8, opacity: generandoAlertas?0.6:1 }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{generandoAlertas ? 'Generando…' : 'Generar alertas (IA)'}</Text></Pressable><TimelineAlertas alertas={alertas} onVista={(id)=>onMarcarAlerta(id,'vista')} onResuelta={(id)=>onMarcarAlerta(id,'resuelta')} /></View>
      </View>
    </View>
  );

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
        {content}
      </ScrollView>
    </View>
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
