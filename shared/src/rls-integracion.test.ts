// Sprint 3 (H1) — RLS contra Postgres real (PGlite, sin docker).
// Ejecuta las policies de verdad con JWTs por rol: técnico asignado,
// técnico ajeno y dueño. Sin regex sobre SQL.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const E = '11111111-1111-4111-8111-111111111111'; // empleado dueño
const A = '22222222-2222-4222-8222-222222222222'; // técnico asignado
const B = '33333333-3333-4333-8333-333333333333'; // técnico ajeno
const T0 = 'a0000000-0000-4000-8000-000000000001'; // abierto, sin técnico
const T1 = 'a0000000-0000-4000-8000-000000000002'; // abierto, asignado a A
const T9 = 'a0000000-0000-4000-8000-000000000099'; // inexistente (deny storage)

let db: PGlite;

function leer(ruta: string): string {
  return readFileSync(new URL(ruta, import.meta.url), 'utf-8');
}

async function como(uid: string): Promise<void> {
  await db.exec(`select set_config('request.jwt.claims', '{"sub":"${uid}"}', false);`);
}

async function filas<T>(sql: string): Promise<T[]> {
  const r = await db.query<T>(sql);
  return r.rows;
}

async function afectados(sql: string): Promise<number> {
  const r = await db.query(sql);
  return r.affectedRows ?? 0;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
    create role authenticated;
    create role anon;
    create schema if not exists storage;
    create table if not exists storage.objects (id uuid primary key, bucket_id text not null, name text not null);
    alter table storage.objects enable row level security;
  `);
  await db.exec(leer('../../supabase/migrations/20260820150246_ticket_categories.sql'));
  await db.exec(leer('../../supabase/migrations/20260820150319_schema_inicial.sql'));
  await db.exec(leer('../../supabase/migrations/20260915000000_fix_profiles_rls_recursion.sql'));
  await db.exec(leer('../../supabase/migrations/20261016000000_rf13_fsm_trigger.sql'));
  await db.exec(leer('../../supabase/migrations/20261016000002_rf10_cancel_policy.sql'));
  await db.exec(leer('../../supabase/migrations/20261018000001_tecnico_update_inmutables.sql'));
  await db.exec(leer('../../supabase/migrations/20261024000000_fix_tecnico_update_recursion.sql'));
  await db.exec(leer('../../supabase/migrations/20261018000000_storage_adjuntos_por_ticket.sql'));
  // La plataforma Supabase otorga privilegios a authenticated fuera de migraciones;
  // en PGlite se replican para que RLS (no los grants) decida.
  await db.exec(`
    grant usage on schema public to authenticated;
    grant all on all tables in schema public to authenticated;
    grant all on all sequences in schema public to authenticated;
    grant usage on schema storage to authenticated;
    grant all on all tables in schema storage to authenticated;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    grant execute on all functions in schema public to authenticated;
  `);
  // Semillas (superusuario, sin RLS)
  await db.exec(`insert into auth.users (id) values ('${E}'), ('${A}'), ('${B}');`);
  await db.exec(`insert into public.mesas (nombre) values ('Mesa 1');`);
  await db.exec(`
    insert into public.profiles (id, full_name, rol) values
    ('${E}', 'Empleado', 'empleado'),
    ('${A}', 'Tecnico A', 'tecnico'),
    ('${B}', 'Tecnico B', 'tecnico');
  `);
  const cats = await filas<{ id: number }>('select id from public.ticket_categories order by id limit 1;');
  const cat = cats[0].id;
  // El trigger de historial lee auth.uid(): se fija dueño antes de sembrar
  await como(E);
  await db.exec(`
    insert into public.tickets (id, usuario_id, mesa_id, categoria_id, asunto, descripcion) values
    ('${T0}', '${E}', 1, ${cat}, 'Asunto inicial ticket', 'Descripcion inicial del ticket sin tecnico'),
    ('${T1}', '${E}', 1, ${cat}, 'Asunto asignado ticket', 'Descripcion asignada del ticket para tecnico');
  `);
  await db.exec(`update public.tickets set tecnico_asignado_id = '${A}' where id = '${T1}';`);
  await db.exec('set role authenticated;');
}, 60000);

describe('tickets_update_tecnico con RLS real', () => {
  it('asignado muta mesa_id (columna mutable)', async () => {
    await como(A);
    expect(await afectados(`update public.tickets set mesa_id = 1 where id = '${T1}';`)).toBe(1);
  });

  it('asignado no muta asunto (inmutable → 42501)', async () => {
    await como(A);
    await expect(filas(`update public.tickets set asunto = 'Cambio indebido' where id = '${T1}';`)).rejects.toThrow(expect.objectContaining({ code: '42501' }));
  });

  it('técnico ajeno no ve ni toca (0 filas, sin error)', async () => {
    await como(B);
    expect(await filas(`select id from public.tickets where id = '${T1}';`)).toHaveLength(0);
    expect(await afectados(`update public.tickets set mesa_id = 1 where id = '${T1}';`)).toBe(0);
  });
});

describe('rls-cancel con RLS real', () => {
  it('dueño cancela abierto sin técnico', async () => {
    await como(E);
    expect(await afectados(`update public.tickets set estado = 'cerrado' where id = '${T0}';`)).toBe(1);
  });

  it('dueño no cancela con técnico asignado (0 filas)', async () => {
    await como(E);
    expect(await afectados(`update public.tickets set estado = 'cerrado' where id = '${T1}';`)).toBe(0);
  });
});

describe('storage-adjuntos con RLS real', () => {
  it('asignado sube al path de su ticket y lee', async () => {
    await como(A);
    expect(await afectados(`insert into storage.objects (id, bucket_id, name) values ('b0000000-0000-4000-8000-000000000001', 'ticket-adjuntos', '${T1}/f.png');`)).toBe(1);
    expect(await filas(`select name from storage.objects where bucket_id = 'ticket-adjuntos';`)).toHaveLength(1);
  });

  it('asignado no sube al path ajeno (42501)', async () => {
    await como(A);
    await expect(
      filas(`insert into storage.objects (id, bucket_id, name) values ('b0000000-0000-4000-8000-000000000002', 'ticket-adjuntos', '${T9}/f.png');`),
    ).rejects.toThrow(expect.objectContaining({ code: '42501' }));
  });

  it('técnico ajeno no lee adjuntos (0 filas)', async () => {
    await como(B);
    expect(await filas(`select name from storage.objects where bucket_id = 'ticket-adjuntos';`)).toHaveLength(0);
  });

  it('dueño sí lee adjuntos de su ticket', async () => {
    await como(E);
    expect(await filas(`select name from storage.objects where bucket_id = 'ticket-adjuntos';`)).toHaveLength(1);
  });
});
