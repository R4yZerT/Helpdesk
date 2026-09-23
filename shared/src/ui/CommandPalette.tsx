// Command palette UI (web/mobile): comandos + resultados de tickets.
// El filtrado de comandos es local; los tickets los provee la app (full-text servidor).
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from './theme.js';
import { Card } from './components.js';
import { filtrarComandos, type ComandoPalette } from '../palette.js';

export type TicketResultado = {
  id: string;
  titulo: string;
  subtitulo?: string;
};

type Props = {
  visible: boolean;
  comandos: ComandoPalette[];
  tickets: TicketResultado[];
  buscandoTickets: boolean;
  onQueryChange: (q: string) => void;
  onEjecutarComando: (id: string) => void;
  onAbrirTicket: (id: string) => void;
  onCerrar: () => void;
};

type Fila =
  | { kind: 'comando'; id: string; titulo: string; subtitulo?: string }
  | { kind: 'ticket'; id: string; titulo: string; subtitulo?: string };

export function CommandPalette({
  visible, comandos, tickets, buscandoTickets,
  onQueryChange, onEjecutarComando, onAbrirTicket, onCerrar,
}: Props) {
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(0);

  React.useEffect(() => {
    if (visible) {
      setQ('');
      setSel(0);
    }
  }, [visible]);

  const filas: Fila[] = React.useMemo(() => {
    const cmds = filtrarComandos(comandos, q).map((c) => ({
      kind: 'comando' as const, id: c.id, titulo: c.titulo, subtitulo: c.atajo,
    }));
    const tks = tickets.map((t) => ({ kind: 'ticket' as const, ...t }));
    return [...cmds, ...tks];
  }, [comandos, tickets, q]);

  if (!visible) return null;

  const activa = filas[sel];
  const ejecutar = (f: Fila | undefined) => {
    if (!f) return;
    if (f.kind === 'comando') onEjecutarComando(f.id);
    else onAbrirTicket(f.id);
  };

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={onCerrar} accessibilityLabel="Cerrar" />
      <Card style={s.card}>
        <TextInput
          value={q}
          onChangeText={(v) => { setQ(v); setSel(0); onQueryChange(v); }}
          placeholder="Escribe un comando o busca un ticket… (Esc cierra)"
          placeholderTextColor={theme.colors.mutedSoft}
          style={s.input}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Buscar comandos y tickets"
          onKeyPress={(e) => {
            const k = (e.nativeEvent as { key?: string }).key;
            if (k === 'Escape') onCerrar();
            else if (k === 'ArrowDown') setSel((i) => Math.min(i + 1, filas.length - 1));
            else if (k === 'ArrowUp') setSel((i) => Math.max(i - 1, 0));
            else if (k === 'Enter') ejecutar(activa);
          }}
          onSubmitEditing={() => ejecutar(activa)}
        />
        <ScrollView style={s.list} keyboardShouldPersistTaps="handled">
          {filas.map((f, i) => (
            <Pressable
              key={`${f.kind}-${f.id}`}
              onPress={() => ejecutar(f)}
              style={[s.row, i === sel && s.rowActive]}
              accessibilityRole="button"
              accessibilityLabel={`${f.kind === 'comando' ? 'Comando' : 'Ticket'} ${f.titulo}`}
            >
              <Text style={s.rowKind}>{f.kind === 'comando' ? '⌘' : '#'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{f.titulo}</Text>
                {f.subtitulo ? <Text style={s.rowSub} numberOfLines={1}>{f.subtitulo}</Text> : null}
              </View>
            </Pressable>
          ))}
          {filas.length === 0 && !buscandoTickets ? (
            <Text style={s.empty}>Sin resultados para “{q}”.</Text>
          ) : null}
          {buscandoTickets ? <Text style={s.empty}>Buscando tickets…</Text> : null}
        </ScrollView>
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, zIndex: 50 },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)' },
  card: { gap: 8, padding: 12, width: '100%', maxWidth: 520 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.surfaceAlt },
  list: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  rowActive: { backgroundColor: theme.colors.primarySoft },
  rowKind: { fontSize: 12, fontWeight: '800', color: theme.colors.primary, width: 16, textAlign: 'center' },
  rowTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  rowSub: { fontSize: 11, color: theme.colors.muted },
  empty: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', padding: 14 },
});
