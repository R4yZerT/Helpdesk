// Registro y filtrado de la command palette.
import { describe, expect, it } from 'vitest';
import {
  comandosParaRol,
  filtrarComandos,
  normalizarBusqueda,
  type ComandoPalette,
} from './palette.js';

const COMANDOS: ComandoPalette[] = [
  { id: 'nueva', titulo: 'Nueva solicitud', keywords: ['crear', 'ticket', 'nuevo'], roles: [] },
  { id: 'bandeja', titulo: 'Ir a bandeja', keywords: ['tecnico', 'asignados'], roles: ['tecnico', 'jefe'] },
  { id: 'admin', titulo: 'Panel admin', keywords: ['usuarios', 'config'], roles: ['administrador'] },
];

describe('normalizarBusqueda', () => {
  it('tolera tildes y mayúsculas', () => {
    expect(normalizarBusqueda('Búsqueda RÁPIDA')).toBe('busqueda rapida');
  });
});

describe('comandosParaRol', () => {
  it('filtra fail-closed por rol', () => {
    expect(comandosParaRol(COMANDOS, 'usuario').map((c) => c.id)).toEqual(['nueva']);
    expect(comandosParaRol(COMANDOS, 'tecnico').map((c) => c.id)).toEqual(['nueva', 'bandeja']);
    expect(comandosParaRol(COMANDOS, 'administrador').map((c) => c.id)).toEqual(['nueva', 'admin']);
  });
});

describe('filtrarComandos', () => {
  it('vacío devuelve todo', () => {
    expect(filtrarComandos(COMANDOS, '')).toHaveLength(3);
  });
  it('matchea por título y keywords con tildes', () => {
    expect(filtrarComandos(COMANDOS, 'creár').map((c) => c.id)).toEqual(['nueva']);
    expect(filtrarComandos(COMANDOS, 'panel config').map((c) => c.id)).toEqual(['admin']);
  });
  it('todas las palabras deben coincidir', () => {
    expect(filtrarComandos(COMANDOS, 'nueva admin')).toHaveLength(0);
  });
});
