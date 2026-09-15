// RF-09 — Historial enriquecido compartido web/mobile
// Muestra creación, cada cambio con actor, hora y duración desde la etapa anterior.
// Evita duplicación entre TicketDetailScreen y DetalleTecnicoScreen.
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme.js';
import type { TicketEstado } from '../../tickets.js';
import { formatDuracion, formatFechaHora } from '../../historial.js';
import { formatEstado } from '../../filters.js';

export type HistorialNombres = {
  usuarios: Record<string, string>;
  mesas: Record<number, string>;
  categorias: Record<number, string>;
};

type Props = {
  creadoEn: string;
  creadorId: string;
  creadorNombre?: string;
  estados: TicketEstado[];
  nombres: HistorialNombres;
  currentUserId?: string;
};

function nombreActor(id: string, nombres: Record<string, string>, currentUserId?: string): string {
  if (currentUserId && id === currentUserId) return 'Tú';
  return nombres[id] ?? `Usuario ${id.slice(0, 8)}…`;
}

function tituloEvento(e: TicketEstado, nombres: HistorialNombres): string {
  if (e.tipoEvento === 'estado') {
    const de = e.estadoAnterior ? formatEstado(e.estadoAnterior) : '—';
    const a = e.estadoNuevo ? formatEstado(e.estadoNuevo) : '—';
    return `${de} → ${a}`;
  }
  // asignacion: distingue dependencia / categoría / técnico por columnas presentes
  if (e.mesaDe != null || e.mesaPara != null) {
    const de = e.mesaDe != null ? (nombres.mesas[e.mesaDe] ?? `Mesa ${e.mesaDe}`) : '—';
    const a = e.mesaPara != null ? (nombres.mesas[e.mesaPara] ?? `Mesa ${e.mesaPara}`) : '—';
    return `Dependencia: ${de} → ${a}`;
  }
  if (e.categoriaDe != null || e.categoriaPara != null) {
    const de = e.categoriaDe != null ? (nombres.categorias[e.categoriaDe] ?? `Cat. ${e.categoriaDe}`) : '—';
    const a = e.categoriaPara != null ? (nombres.categorias[e.categoriaPara] ?? `Cat. ${e.categoriaPara}`) : '—';
    return `Categoría: ${de} → ${a}`;
  }
  // asignacion (técnico)
  const de = e.tecnicoDe ? (nombres.usuarios[e.tecnicoDe] ?? 'Técnico') : 'Sin asignar';
  const a = e.tecnicoPara ? (nombres.usuarios[e.tecnicoPara] ?? 'Técnico') : 'Sin asignar';
  return `Asignación: ${de} → ${a}`;
}

export function TicketHistoryList({ creadoEn, creadorId, creadorNombre, estados, nombres, currentUserId }: Props) {
  const ordenados = [...estados].sort(
    (a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
  );
  let previoISO = creadoEn;
  return (
    <View style={{ gap: 0 }}>
      {/* Creación — siempre primera, sin duración */}
      <View style={s.row}>
        <View style={s.dotCol}><View style={[s.dot, s.dotCreate]} /><View style={s.line} /></View>
        <View style={s.body}>
          <Text style={s.title}>Ticket creado</Text>
          <Text style={s.meta}>{formatFechaHora(creadoEn)} · por {creadorNombre ?? nombreActor(creadorId, nombres.usuarios, currentUserId)}</Text>
        </View>
      </View>
      {ordenados.map((e) => {
        const dur = formatDuracion(previoISO, e.creadoEn);
        const meta = `${formatFechaHora(e.creadoEn)}${dur ? ` · +${dur} desde anterior` : ''} · por ${nombreActor(e.usuarioId, nombres.usuarios, currentUserId)}`;
        previoISO = e.creadoEn;
        return (
          <View key={e.id} style={s.row}>
            <View style={s.dotCol}><View style={s.dot} /><View style={s.line} /></View>
            <View style={s.body}>
              <Text style={s.title}>{tituloEvento(e, nombres)}</Text>
              <Text style={s.meta}>{meta}</Text>
              {e.comentario ? <Text style={s.comment}>{e.comentario}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dotCol: { alignItems: 'center', width: 12 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: theme.colors.primary, marginTop: 4 },
  dotCreate: { backgroundColor: theme.colors.success },
  line: { flex: 1, width: 1, backgroundColor: theme.colors.border, marginTop: 6, opacity: 0.8 },
  body: { flex: 1, gap: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  title: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  meta: { fontSize: 11, color: theme.colors.mutedSoft },
  comment: { fontSize: 11, color: theme.colors.textSoft, marginTop: 4 },
});
