import { describe, it, expect } from 'vitest';
import { getSlaVencimiento, getSlaEstado, getSlaProgreso, formatSlaRestante, SLA_MINUTOS } from './sla.js';

describe('sla', () => {
  it('SLA_MINUTOS por prioridad', () => {
    expect(SLA_MINUTOS.critica).toBe(60);
    expect(SLA_MINUTOS.alta).toBe(240);
    expect(SLA_MINUTOS.media).toBe(1440);
    expect(SLA_MINUTOS.baja).toBe(4320);
  });
  it('getSlaVencimiento suma duración', () => {
    const creado = '2026-03-10T10:00:00.000Z';
    expect(getSlaVencimiento(creado, 'critica').toISOString()).toBe('2026-03-10T11:00:00.000Z');
    expect(getSlaVencimiento(creado, 'alta').toISOString()).toBe('2026-03-10T14:00:00.000Z');
  });
  it('getSlaEstado vigente/por_vencer/vencido', () => {
    const creado = '2026-03-10T10:00:00.000Z';
    const venceCritica = getSlaVencimiento(creado, 'critica').toISOString(); // 11:00
    // 10:15 vigente
    expect(getSlaEstado({ creadoEn: creado, prioridad: 'critica', estado: 'abierto', venceEn: venceCritica, ahora: new Date('2026-03-10T10:15:00Z') })).toBe('vigente');
    // 10:50 por vencer (resta 10m <60m threshold)
    expect(getSlaEstado({ creadoEn: creado, prioridad: 'critica', estado: 'abierto', venceEn: venceCritica, ahora: new Date('2026-03-10T10:50:00Z') })).toBe('por_vencer');
    // 11:10 vencido
    expect(getSlaEstado({ creadoEn: creado, prioridad: 'critica', estado: 'abierto', venceEn: venceCritica, ahora: new Date('2026-03-10T11:10:00Z') })).toBe('vencido');
  });
  it('cumplido vs vencido_tarde', () => {
    const creado = '2026-03-10T10:00:00Z';
    const vence = getSlaVencimiento(creado, 'critica').toISOString();
    expect(getSlaEstado({ creadoEn: creado, prioridad: 'critica', estado: 'cerrado', venceEn: vence, fechaResolucion: '2026-03-10T10:50:00Z' })).toBe('cumplido');
    expect(getSlaEstado({ creadoEn: creado, prioridad: 'critica', estado: 'cerrado', venceEn: vence, fechaResolucion: '2026-03-10T12:00:00Z' })).toBe('vencido_tarde');
  });
  it('formatSlaRestante', () => {
    expect(formatSlaRestante(5)).toBe('5 min restantes');
    expect(formatSlaRestante(90)).toBe('1 h 30 min');
    expect(formatSlaRestante(-30)).toMatch(/Vencido/);
  });
  it('getSlaProgreso 0-100+', () => {
    const creado = '2026-03-10T10:00:00Z';
    const vence = getSlaVencimiento(creado, 'critica').toISOString();
    expect(getSlaProgreso(creado, vence, new Date('2026-03-10T10:30:00Z'))).toBeCloseTo(50);
    expect(getSlaProgreso(creado, vence, new Date('2026-03-10T11:30:00Z'))).toBeGreaterThan(100);
  });
});
