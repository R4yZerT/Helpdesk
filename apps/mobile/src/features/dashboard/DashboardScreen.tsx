// Dashboard mobile — wrapper delgado, lógica en shared
import * as React from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FilterBar, theme, getKPIs, getStatsPorEstado, getStatsPorPrioridad, getEvolucionPorMesa, getCargaHoraria, listAlertasIA, generarAlertasIA, marcarAlertaIA, fetchMesas, getPicosPrediccion, getPicosResumen, getPronosticoSemanal, getPatronesCategoria, getMesaIdPorDominio, fetchTicketsFiltrados, ticketsToRows, toCsvWithMeta, buildExportFilename, downloadCsv, type DashboardFilters, type FilterRange, type PronosticoDia, useFeedback } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { shareCsvNativo } from '../../lib/share-csv';
import { KpiRow } from '@helpdesk/shared/ui/dashboard/KpiRow.js';
import { EstadoPrioridadRow } from '@helpdesk/shared/ui/dashboard/EstadoPrioridadRow.js';
import { ChartsSection } from '@helpdesk/shared/ui/dashboard/ChartsSection.js';
import { CargaAlertasSection } from '@helpdesk/shared/ui/dashboard/CargaAlertasSection.js';

export function DashboardScreen() {
  const fb = useFeedback();
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
  const [picos, setPicos] = React.useState<any[]>([]);
  const [picosResumen, setPicosResumen] = React.useState<any[]>([]);
  const [pronosticoML, setPronosticoML] = React.useState<PronosticoDia[]>([]);
  const [patrones, setPatrones] = React.useState<any[]>([]);
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
      const [k, e, p, ev, c, pp, pr, pat, a, ms, ml] = await Promise.all([
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
      ]);
      setKpis(k); setPorEstado(e); setPorPrioridad(p); setEvolucion(ev); setCarga(c); setPicos(pp); setPicosResumen(pr); setPatrones(pat as any); setAlertas(a); setPronosticoML(ml);
      if (!mesas.length) setMesas(ms as any);
    } catch (err) {
      console.warn('[Dashboard] load', err);
    } finally { setLoading(false); setRefreshing(false); }
  }, [filters, mesas.length]);

  React.useEffect(() => { setLoading(true); load(); }, [load]);
  React.useEffect(() => {
    const ch = supabase.channel('dashboard-tickets').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  React.useEffect(() => {
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
      if (cat && (cat as any).dominio && typeof (cat as any).dominio === 'string') {
        if (getMesaIdPorDominio(cat.dominio) !== mesaIds[0]) setCategoriaId('');
      }
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
      const filename = buildExportFilename('dashboard', 'csv');
      if (Platform.OS !== 'web') {
        const shared = await shareCsvNativo(filename, csv);
        fb.show(shared ? 'CSV listo' : 'Compartir no disponible', shared ? `CSV listo para compartir: ${rows.length} filas.` : 'Compartir no disponible en este dispositivo', shared ? 'success' : 'warning');
        return;
      }
      downloadCsv(filename, csv);
      fb.show('CSV descargado', `CSV generado (${rows.length} filas).`, 'success');
    } catch (e: any) { console.warn('[Dashboard] export', e); fb.show('Error al exportar', e?.message ?? 'Error al exportar CSV', 'error'); }
  }, [filters, mesas, categorias, tecnicos]);

  const onExportPng = React.useCallback(async () => {
    try {
      if (Platform.OS !== 'web' || typeof document === 'undefined') { fb.show('Solo en web', 'PNG de gráficas solo en web — en móvil usa CSV', 'info'); return; }
      const el = document.getElementById('dashboard-export-root') as HTMLElement | null;
      if (!el) { fb.show('Sin gráficas', 'No se encontró el contenedor de gráficas', 'warning'); return; }
      const html2canvas = await import('html2canvas');
      const canvas = await (html2canvas.default as any)(el, { backgroundColor: '#F8FAFC', scale: 2, useCORS: true, logging: false });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = (await import('@helpdesk/shared')).buildExportFilename('dashboard', 'png'); a.click();
    } catch (e) { console.warn('[Dashboard] export png', e); fb.show('Error al exportar', 'Error al exportar PNG', 'error'); }
  }, []);
  const onExportPdf = React.useCallback(async () => {
    try {
      if (Platform.OS !== 'web' || typeof document === 'undefined') { fb.show('Solo en web', 'PDF de gráficas solo en web — en móvil usa CSV', 'info'); return; }
      const el = document.getElementById('dashboard-export-root') as HTMLElement | null;
      if (!el) { fb.show('Sin gráficas', 'No se encontró el contenedor de gráficas', 'warning'); return; }
      const html2canvas = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const canvas = await (html2canvas.default as any)(el, { backgroundColor: '#FFFFFF', scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save((await import('@helpdesk/shared')).buildExportFilename('dashboard', 'pdf'));
    } catch (e) { console.warn('[Dashboard] export pdf', e); fb.show('Error al exportar', 'Error al exportar PDF', 'error'); }
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
          <ChartsSection evolucion={evolucion} mesas={mesas} picos={picos} picosResumen={picosResumen} pronosticoML={pronosticoML} patrones={patrones} />
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
});