// RF IA validación — evita tarjetas vacías y limita el feedback al técnico asignado.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function repo(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Tarjeta de validación IA', () => {
  const card = repo('shared/src/ui/ticket/IaValidationCard.tsx');

  it('oculta placeholders y sugerencias incompletas', () => {
    expect(card).toContain('if (!haySugerencia) return null;');
    expect(card).toContain('fb.sugeridoCategoriaId != null && fb.sugeridoMesaId != null');
    expect(card).toContain('if (!fb || fb.estado !== \'pendiente\') return null;');
  });

  it('solo permite validar al técnico asignado y no expone valores internos vacíos', () => {
    expect(card).toContain('validadorId !== ticketTecnicoAsignadoId');
    expect(card).toContain('if (!(fb.fuente in FUENTE_LABEL)) return null;');
    expect(card).toContain('beto: \'BETO\'');
    expect(card).toContain('reglas: \'reglas locales\'');
    expect(card).not.toContain('fuente desconocida');
    expect(card).not.toContain('Cat —');
    expect(card).not.toContain('#—');
  });

  it('explica la validación y compara la sugerencia con la clasificación actual', () => {
    expect(card).toContain('Como técnico asignado, confirma si la clasificación coincide con el problema reportado.');
    expect(card).toContain('Sugerencia de IA');
    expect(card).toContain('Clasificación actual');
    expect(card).toContain('No, reclasificar');
  });

  it('web y móvil pasan el técnico asignado del ticket', () => {
    for (const path of [
      'apps/web/src/features/tecnico/DetalleTecnicoScreen.tsx',
      'apps/mobile/src/features/tecnico/DetalleTecnicoScreen.tsx',
    ]) {
      expect(repo(path)).toContain('ticketTecnicoAsignadoId={');
    }
  });
});
