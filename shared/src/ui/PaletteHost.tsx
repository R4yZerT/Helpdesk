// Host reutilizable: comandos + búsqueda de tickets + ejecución vía nav.
// La app provee comandos (con pantalla destino) y buscarTickets (full-text servidor).
import * as React from 'react';
import { CommandPalette, type TicketResultado } from './CommandPalette.js';
import { comandosParaRol } from '../palette.js';
import type { ComandoPalette } from '../palette.js';
import type { RolUsuario } from '../types.js';

export type ComandoNav = ComandoPalette & {
  pantalla: string;
  params?: Record<string, unknown>;
};

type Nav = {
  navigate: (pantalla: string, params?: Record<string, unknown>) => void;
};

type Props = {
  visible: boolean;
  onCerrar: () => void;
  rol: RolUsuario;
  nav: Nav | null;
  comandos: ComandoNav[];
  buscarTickets: (q: string) => Promise<TicketResultado[]>;
};

export function PaletteHost({ visible, onCerrar, rol, nav, comandos, buscarTickets }: Props) {
  const [tickets, setTickets] = React.useState<TicketResultado[]>([]);
  const [buscando, setBuscando] = React.useState(false);
  const debounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const vivos = React.useRef(true);

  React.useEffect(() => {
    vivos.current = true;
    return () => { vivos.current = false; };
  }, []);

  React.useEffect(() => {
    if (!visible) {
      setTickets([]);
      setBuscando(false);
      if (debounce.current) clearTimeout(debounce.current);
    }
  }, [visible ]);

  const onQueryChange = React.useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    const texto = q.trim();
    if (texto.length < 3) {
      setTickets([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    debounce.current = setTimeout(() => {
      buscarTickets(texto).then((r) => {
        if (vivos.current) {
          setTickets(r.slice(0, 8));
          setBuscando(false);
        }
      }).catch(() => {
        if (vivos.current) {
          setTickets([]);
          setBuscando(false);
        }
      });
    }, 350);
  }, [buscarTickets]);

  const onEjecutarComando = React.useCallback((id: string) => {
    const c = comandos.find((x) => x.id === id);
    if (c && nav) nav.navigate(c.pantalla, c.params);
    onCerrar();
  }, [comandos, nav, onCerrar]);

  const onAbrirTicket = React.useCallback((id: string) => {
    if (nav) nav.navigate('DetalleTicket', { id });
    onCerrar();
  }, [nav, onCerrar]);

  return (
    <CommandPalette
      visible={visible}
      comandos={comandosParaRol(comandos, rol)}
      tickets={tickets}
      buscandoTickets={buscando}
      onQueryChange={onQueryChange}
      onEjecutarComando={onEjecutarComando}
      onAbrirTicket={onAbrirTicket}
      onCerrar={onCerrar}
    />
  );
}
