// RF-26 web — Importación de histórico: upload CSV (latin-1), preview, mapeo de columnas,
// insert real a `tickets` en batches + log de auditoría en `import_historico_log`.
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme, fetchCategorias, fetchMesas, mapImportRowsToTickets } from '@helpdesk/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type ImportLog = {
  id: string;
  archivo: string;
  filas_raw: number;
  filas_clean: number;
  filas_cuarentena: number;
  clases: number;
  creado_en: string;
};

// Parser CSV mínimo con soporte de comillas (suficiente para preview/mapeo en cliente).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r') { /* ignora CR */ }
    else cur += c;
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const norm = (s: string) => s.normalize('NFD').toLowerCase().trim();

function autoMap(headers: string[]): { texto: number; categoria: number; dependencia: number; fecha: number } {
  const find = (...keys: string[]) => headers.findIndex((h) => keys.some((k) => norm(h).includes(k)));
  return {
    texto: find('descripcion_clean', 'descripcion', 'texto', 'asunto_clean', 'asunto'),
    categoria: find('categoria_label', 'categoria_sub', 'categoria', 'label'),
    dependencia: find('dependencia_clean', 'dependencia', 'mesa'),
    fecha: find('fecha_parsed', 'fecha', 'created_at'),
  };
}

export function AdminImportScreen() {
  const { profile } = useAuth();
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [map, setMap] = React.useState({ texto: -1, categoria: -1, dependencia: -1, fecha: -1 });
  const [saving, setSaving] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<ImportLog[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);

  const loadHistory = React.useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error: e } = await supabase
        .from('import_historico_log')
        .select('id,archivo,filas_raw,filas_clean,filas_cuarentena,clases,creado_en')
        .order('creado_en', { ascending: false })
        .limit(20);
      if (e) throw e;
      setHistory((data ?? []) as ImportLog[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar historial de importaciones');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  React.useEffect(() => { loadHistory(); }, [loadHistory]);

  const pickFile = React.useCallback(() => {
    setError(null); setOk(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      // RF-26: el histórico viene en latin-1; se decodifica y normaliza a NFD como cleaning.py
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '').normalize('NFD');
          const parsed = parseCsv(text);
          if (parsed.length < 2) throw new Error('El CSV no tiene filas de datos (se esperaba cabecera + filas).');
          const [h, ...body] = parsed;
          setHeaders(h);
          setRows(body);
          setFileName(f.name);
          setMap(autoMap(h));
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No se pudo leer el CSV');
        }
      };
      reader.onerror = () => setError('No se pudo leer el archivo');
      reader.readAsText(f, 'ISO-8859-1');
    };
    input.click();
  }, []);

  const stats = React.useMemo(() => {
    if (rows.length === 0) return null;
    const seen = new Set<string>();
    const cats = new Set<string>();
    let clean = 0;
    let cuarentena = 0;
    for (const r of rows) {
      const texto = map.texto >= 0 ? (r[map.texto] ?? '').trim() : '';
      const key = norm(texto);
      if (!texto || seen.has(key)) cuarentena++;
      else { clean++; seen.add(key); }
      if (map.categoria >= 0) {
        const c = (r[map.categoria] ?? '').trim();
        if (c) cats.add(norm(c));
      }
    }
    return { raw: rows.length, clean, cuarentena, clases: cats.size };
  }, [rows, map]);

  const preview = React.useMemo(() => rows.slice(0, 8), [rows]);

  const onRegister = React.useCallback(async () => {
    if (!stats || !fileName) return;
    setSaving(true);
    setError(null); setOk(null);
    try {
      const iniciadoPor = (profile as unknown as { id?: string } | null)?.id ?? null;
      const { error: e } = await supabase.from('import_historico_log').insert({
        archivo: fileName,
        filas_raw: stats.raw,
        filas_clean: stats.clean,
        filas_cuarentena: stats.cuarentena,
        clases: stats.clases,
        iniciado_por: iniciadoPor,
      });
      if (e) throw e;
      setOk(`Corrida registrada: ${stats.clean} limpias, ${stats.cuarentena} en cuarentena, ${stats.clases} clases. Usa «Importar tickets válidos a BD» para el insert real.`);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar la importación');
    } finally {
      setSaving(false);
    }
  }, [stats, fileName, profile, loadHistory]);

  // A5: insert real a `tickets` (batches de 200). Requiere policy
  // tickets_insert_admin_import (migración 20261016000001); sin ella RLS rechaza
  // al administrador con 42501 aunque la pantalla exija profile:manage.
  const onImport = React.useCallback(async () => {
    if (rows.length === 0 || map.texto < 0) {
      setError('Selecciona un CSV con columna de texto mapeada antes de importar.');
      return;
    }
    setImporting(true);
    setError(null); setOk(null);
    try {
      const adminId = (profile as unknown as { id?: string } | null)?.id ?? null;
      if (!adminId) throw new Error('Sesión sin perfil (reingresa).');
      const [cats, mss] = await Promise.all([fetchCategorias(supabase as any), fetchMesas(supabase as any)]);
      const { valid, cuarentena } = mapImportRowsToTickets(rows, map, cats as any, mss as any, adminId);
      if (valid.length === 0) throw new Error(`Nada que importar: ${cuarentena} filas en cuarentena (revisa el mapeo categoría/dependencia).`);
      let inserted = 0;
      for (let i = 0; i < valid.length; i += 200) {
        const batch = valid.slice(i, i + 200);
        const { error: e } = await supabase.from('tickets').insert(batch as any);
        if (e) throw e;
        inserted += batch.length;
      }
      const { error: logErr } = await supabase.from('import_historico_log').insert({
        archivo: fileName ?? 'importacion',
        filas_raw: rows.length,
        filas_clean: inserted,
        filas_cuarentena: cuarentena,
        clases: stats?.clases ?? 0,
        iniciado_por: adminId,
      });
      if (logErr) throw logErr;
      setOk(`Importados ${inserted} tickets en BD (cuarentena: ${cuarentena}). Corrida registrada en el log.`);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar tickets');
    } finally {
      setImporting(false);
    }
  }, [rows, map, fileName, stats, profile, loadHistory]);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <Text style={s.h1}>Importar histórico</Text>
      <Text style={s.subtitle}>
        Sube el CSV del histórico (latin-1 → UTF-8 NFD, igual que `ml/src/cleaning.py`). Se valida, se mapea, se insertan los tickets válidos en BD y se registra la corrida en el log de auditoría (RF-26).
      </Text>

      <Pressable onPress={pickFile} style={s.btnPrimary}>
        <Text style={s.btnPrimaryText}>{fileName ? `Cambiar archivo (${fileName})` : 'Seleccionar CSV'}</Text>
      </Pressable>

      {error ? <Text style={s.error}>{error}</Text> : null}
      {ok ? <Text style={s.ok}>{ok}</Text> : null}

      {rows.length > 0 && stats ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Resumen</Text>
          <Text style={s.stat}>Filas raw: {stats.raw}</Text>
          <Text style={s.stat}>Filas clean: {stats.clean}</Text>
          <Text style={s.stat}>Cuarentena (vacías/duplicadas): {stats.cuarentena}</Text>
          <Text style={s.stat}>Clases detectadas: {stats.clases}</Text>

          <Text style={s.cardTitle}>Mapeo de columnas</Text>
          {(['texto', 'categoria', 'dependencia', 'fecha'] as const).map((k) => (
            <Text key={k} style={s.stat}>
              {k}: {map[k] >= 0 ? headers[map[k]] : '— (no detectada)'}
            </Text>
          ))}

          <Text style={s.cardTitle}>Preview (8 primeras)</Text>
          {preview.map((r, i) => (
            <Text key={i} style={s.previewRow} numberOfLines={2}>
              {map.texto >= 0 ? r[map.texto]?.slice(0, 120) : r.slice(0, 3).join(' | ').slice(0, 120)}
            </Text>
          ))}

          <Pressable onPress={onRegister} disabled={saving || importing} style={[s.btnPrimary, (saving || importing) && { opacity: 0.6 }]}>
            <Text style={s.btnPrimaryText}>{saving ? 'Registrando…' : 'Registrar corrida en el log'}</Text>
          </Pressable>
          <Pressable onPress={onImport} disabled={importing || saving} style={[s.btnPrimary, (importing || saving) && { opacity: 0.6 }]}>
            <Text style={s.btnPrimaryText}>{importing ? 'Importando…' : 'Importar tickets válidos a BD'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={s.cardTitle}>Historial de importaciones</Text>
      {loadingHistory ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : history.length === 0 ? (
        <Text style={s.muted}>Sin corridas registradas.</Text>
      ) : (
        history.map((h) => (
          <View key={h.id} style={s.card}>
            <Text style={s.statBold}>{h.archivo}</Text>
            <Text style={s.stat}>raw {h.filas_raw} · clean {h.filas_clean} · cuarentena {h.filas_cuarentena} · clases {h.clases}</Text>
            <Text style={s.muted}>{new Date(h.creado_en).toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, gap: 12 },
  h1: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  subtitle: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  error: { fontSize: 12, color: theme.colors.danger, fontWeight: '600' },
  ok: { fontSize: 12, color: theme.colors.success, fontWeight: '600' },
  muted: { fontSize: 12, color: theme.colors.muted },
  btnPrimary: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: theme.colors.border },
  cardTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  stat: { fontSize: 12, color: theme.colors.text },
  statBold: { fontSize: 12, color: theme.colors.text, fontWeight: '800' },
  previewRow: { fontSize: 11, color: theme.colors.muted },
});
