// RF-22 — predecirCategoria + classifyLocal + resolución de mesa (tests unitarios)
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyLocal,
  getMesaIdPorDominio,
  getMesaNombrePorDominio,
  getPrioridadPorCategoria,
  predecirCategoria,
  resolverMesaId,
  type CatalogosPrediccion,
} from './ia.js';
import type { Mesa, TicketCategoria } from './tickets.js';
import { getPrioridadPorSubcategoria } from './types.js';

// Catálogo sintético con IDs NO secuenciales: prueba que nada depende de IDs fijos.
const categorias: TicketCategoria[] = [
  { id: 101, dominio: 'tic', subcategoria: 'Conectividad y redes', orden: 1, activa: true },
  { id: 102, dominio: 'tic', subcategoria: 'Correo electrónico', orden: 2, activa: true },
  { id: 103, dominio: 'tic', subcategoria: 'Equipos e Infraestructura', orden: 3, activa: true },
  { id: 104, dominio: 'tic', subcategoria: 'Gestión de Accesos y Seguridad', orden: 4, activa: true },
  { id: 105, dominio: 'tic', subcategoria: 'Software y Sistemas', orden: 5, activa: true },
  { id: 106, dominio: 'comunicaciones', subcategoria: 'Audiovisual', orden: 6, activa: true },
  { id: 107, dominio: 'comunicaciones', subcategoria: 'Eventos y branding', orden: 7, activa: true },
  { id: 108, dominio: 'comunicaciones', subcategoria: 'Piezas gráficas y diseño', orden: 8, activa: true },
  { id: 109, dominio: 'comunicaciones', subcategoria: 'Web y publicaciones', orden: 9, activa: true },
  { id: 110, dominio: 'infraestructura', subcategoria: 'Carpintería y mobiliario', orden: 10, activa: true },
  { id: 111, dominio: 'infraestructura', subcategoria: 'Eléctrica', orden: 11, activa: true },
  { id: 112, dominio: 'infraestructura', subcategoria: 'Hidrosanitaria', orden: 12, activa: true },
  { id: 113, dominio: 'infraestructura', subcategoria: 'Obra civil y mantenimiento locativo', orden: 13, activa: true },
];
const mesas: Mesa[] = [
  { id: 11, nombre: 'TIC', activa: true },
  { id: 22, nombre: 'Comunicaciones', activa: true },
  { id: 33, nombre: 'Infraestructura', activa: true },
  { id: 44, nombre: 'EAPSA', activa: true },
];
const catalogos: CatalogosPrediccion = { categorias, mesas };

describe('classifyLocal por nombres (13 categorías consolidadas)', () => {
  it('wifi -> Conectividad y redes', () => {
    const r = classifyLocal('El wifi del bloque 3 se cae cada 10 minutos desde ayer', categorias);
    expect(r?.categoriaId).toBe(101);
    expect(r?.dominio).toBe('tic');
    expect(r?.prioridad).toBe('critica');
  });
  it('impresora -> Equipos e Infraestructura', () => {
      const r = classifyLocal('La impresora del primer piso no imprime y muestra atasco de papel', categorias);
      expect(r?.categoriaId).toBe(103);
    });
  it('banner -> Piezas gráficas y diseño', () => {
    const r = classifyLocal('Necesito un banner y un flyer para el evento de grados de este viernes', categorias);
    expect(r?.categoriaId).toBe(108);
    expect(r?.prioridad).toBe('baja');
  });
  it('fuga -> Hidrosanitaria', () => {
    const r = classifyLocal('Hay una fuga de agua en el baño del segundo piso que inunda el pasillo', categorias);
    expect(r?.categoriaId).toBe(112);
    expect(r?.prioridad).toBe('alta');
  });
  it('crear cuenta -> Gestión de Accesos y Seguridad', () => {
    const r = classifyLocal('Por favor crear cuenta de usuario y permisos de acceso para el nuevo docente', categorias);
    expect(r?.categoriaId).toBe(104);
    expect(r?.prioridad).toBe('alta');
  });
  it('texto corto -> null (no se fuerza categoría)', () => {
    expect(classifyLocal('hola mundo', categorias)).toBeNull();
  });
  it('sin match -> null (no se fuerza categoría)', () => {
    expect(classifyLocal('Quisiera saber el horario de atención de la biblioteca central mañana', categorias)).toBeNull();
  });
  it('ignora reglas cuya categoría ya no existe en el catálogo', () => {
    const sinImpresoras = categorias.filter((c) => c.id !== 103);
    const r = classifyLocal('La impresora del primer piso no imprime y muestra atasco de papel', sinImpresoras);
    // 'imprimir'/'impresora' no resuelven; no debe devolver el id 103 inexistente
    expect(r?.categoriaId).not.toBe(103);
  });
});

describe('resolución de mesa por nombre (IDs reales)', () => {
  it('tic -> mesa TIC con su ID real', () => {
    expect(resolverMesaId('tic', mesas)).toBe(11);
    expect(resolverMesaId('infraestructura', mesas)).toBe(33);
    expect(resolverMesaId('comunicaciones', mesas)).toBe(22);
  });
  it('getMesaNombrePorDominio', () => {
    expect(getMesaNombrePorDominio('tic')).toBe('TIC');
    expect(getMesaNombrePorDominio('general')).toBe('EAPSA');
    expect(getMesaNombrePorDominio('desconocido')).toBeNull();
  });
  it('getMesaIdPorDominio legacy intacto (dashboards)', () => {
    expect(getMesaIdPorDominio('tic')).toBe(1);
    expect(getMesaIdPorDominio('infraestructura')).toBe(3);
  });
});

describe('prioridad por nombre de subcategoría', () => {
  it('mapea las 13 consolidadas', () => {
    expect(getPrioridadPorSubcategoria('Conectividad y redes')).toBe('critica');
    expect(getPrioridadPorSubcategoria('Eléctrica')).toBe('critica');
    expect(getPrioridadPorSubcategoria('Correo electrónico')).toBe('media');
    expect(getPrioridadPorSubcategoria('Software y Sistemas')).toBe('media');
    expect(getPrioridadPorSubcategoria('Equipos e Infraestructura')).toBe('alta');
    expect(getPrioridadPorSubcategoria('Gestión de Accesos y Seguridad')).toBe('alta');
    expect(getPrioridadPorSubcategoria('Hidrosanitaria')).toBe('alta');
    expect(getPrioridadPorSubcategoria('Piezas gráficas y diseño')).toBe('baja');
    expect(getPrioridadPorSubcategoria('Eventos y branding')).toBe('baja');
  });
  it('desconocida -> media', () => {
    expect(getPrioridadPorSubcategoria('Categoría inventada')).toBe('media');
  });
});

describe('predecirCategoria con Beto', () => {
  it('retorna resultado de Beto cuando responde', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ dominio: 'tic', subcategoria: 'equipos e infraestructura', confianza: 0.85 }),
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as never);
    const r = await predecirCategoria('La impresora no imprime', catalogos);
    expect(r).not.toBeNull();
    expect(r?.categoriaId).toBe(103);
    expect(r?.fuente).toBe('beto');
  });
  it('retorna null cuando Beto falla y reglas no match', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as never);
    const r = await predecirCategoria('xyz', catalogos);
    expect(r).toBeNull();
  });
});

describe('classifyLocal', () => {
  it('texto corto -> null', () => {
    expect(classifyLocal('hola', categorias)).toBeNull();
  });
  it('sin match -> null', () => {
    expect(classifyLocal('biblioteca central', categorias)).toBeNull();
  });
});

describe('resolverMesaId', () => {
  it('resolve por nombre con IDs reales', () => {
    expect(resolverMesaId('tic', mesas)).toBe(11);
    expect(resolverMesaId('infraestructura', mesas)).toBe(33);
    expect(resolverMesaId('comunicaciones', mesas)).toBe(22);
  });
  it('fallback legacy cuando el dominio no existe en catálogo', () => {
    expect(resolverMesaId('general', mesas)).toBe(44); // EAPSA en catálogo
    expect(resolverMesaId('desconocido', mesas)).toBeNull(); // dominio desconocido + sin mesas match
  });
});