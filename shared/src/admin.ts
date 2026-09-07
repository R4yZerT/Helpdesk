// RF-27 / RF-28 — Administración de usuarios (solo administrador)
// Contrato espejo de supabase/migrations/*_schema_inicial.sql y handle_new_user
import type { RolUsuario } from './types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mesa } from './tickets.js';
import { ROLES, isRolUsuario } from './roles.js';

// La DB usa 'empleado' pero la app usa 'usuario' (compatibilidad histórica)
// Reusa ROLES de roles.ts; aquí solo mapeo DB<->app
export function mapRolToDb(rol: RolUsuario): string {
  return rol === 'usuario' ? 'empleado' : rol;
}

export function mapRolFromDb(dbRol: string): RolUsuario {
  return dbRol === 'empleado' ? 'usuario' : (dbRol as RolUsuario);
}

// Entidad leída de public.profiles (con join mesa)
export type AdminUser = {
  id: string;
  fullName: string;
  email: string; // viene de auth.users o de profiles si se guarda copia; si no existe se deja vacío y se resuelve por separado
  rol: RolUsuario;
  mesaId: number | null;
  mesaNombre?: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
};

// Input creación (RF-27: admin crea usuario con rol+mesa)
export type CreateUserInput = {
  fullName: string;
  email: string;
  password: string;
  rol: RolUsuario;
  mesaId: number | null;
};

export type UpdateUserInput = {
  fullName?: string;
  rol?: RolUsuario;
  mesaId?: number | null;
  activo?: boolean;
};

export type CreateUserErrors = Partial<Record<keyof CreateUserInput, string>>;
export type UpdateUserErrors = Partial<Record<keyof UpdateUserInput, string>>;

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function validateCreateUser(input: CreateUserInput): CreateUserErrors {
  const e: CreateUserErrors = {};
  const name = input.fullName.trim();
  if (name.length < 3) e.fullName = 'Nombre mínimo 3 caracteres';
  else if (name.length > 80) e.fullName = 'Nombre máximo 80 caracteres';
  if (!isEmail(input.email.trim())) e.email = 'Email inválido';
  if (!input.password || input.password.length < 8) e.password = 'Mínimo 8 caracteres';
  else if (input.password.length > 72) e.password = 'Máximo 72 caracteres';
  if (!isRolUsuario(input.rol)) e.rol = 'Rol inválido';
  if (input.mesaId !== null && (!Number.isInteger(input.mesaId) || input.mesaId <= 0)) e.mesaId = 'Mesa inválida';
  return e;
}

export function validateUpdateUser(input: UpdateUserInput): UpdateUserErrors {
  const e: UpdateUserErrors = {};
  if (input.fullName !== undefined) {
    const n = input.fullName.trim();
    if (n.length < 3) e.fullName = 'Nombre mínimo 3 caracteres';
    else if (n.length > 80) e.fullName = 'Nombre máximo 80 caracteres';
  }
  if (input.rol !== undefined && !isRolUsuario(input.rol)) e.rol = 'Rol inválido';
  if (input.mesaId !== undefined && input.mesaId !== null && (!Number.isInteger(input.mesaId) || input.mesaId <= 0))
    e.mesaId = 'Mesa inválida';
  return e;
}

export function isCreateUserValid(i: CreateUserInput): boolean {
  return Object.keys(validateCreateUser(i)).length === 0;
}
export function isUpdateUserValid(i: UpdateUserInput): boolean {
  return Object.keys(validateUpdateUser(i)).length === 0;
}

// Filtros listado admin
export type ListUsersParams = {
  search?: string; // busca en full_name (ilike)
  rol?: RolUsuario | 'todos';
  mesaId?: number | 'todos';
  activo?: boolean | 'todos';
  page?: number; // 1-indexed
  pageSize?: number; // default 20
};

// --- Supabase wrappers (requieren RLS administrador) ---
// Nota: creación de auth user requiere service_role. Intentamos admin.createUser si el cliente tiene privilegios;
// si falla por permisos (anon), fallback: devuelve error claro para que la app use Edge Function / invite.

export async function listUsers(
  supabase: SupabaseClient,
  params: ListUsersParams = {},
): Promise<{ data: AdminUser[]; count: number }> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from('profiles').select('id, full_name, rol, mesa_id, activo, creado_en, actualizado_en, mesas(nombre)', { count: 'exact' });

  if (params.search?.trim()) q = q.ilike('full_name', `%${params.search.trim()}%`);
  if (params.rol && params.rol !== 'todos') q = q.eq('rol', mapRolToDb(params.rol));
  if (params.mesaId && params.mesaId !== 'todos') q = q.eq('mesa_id', params.mesaId);
  if (typeof params.activo === 'boolean') q = q.eq('activo', params.activo);

  q = q.order('creado_en', { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    full_name: string;
    rol: string;
    mesa_id: number | null;
    activo: boolean;
    creado_en: string;
    actualizado_en: string;
    mesas: { nombre: string } | null;
  }>;
  const mapped: AdminUser[] = rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: '', // se resuelve vía auth si se necesita; profiles no guarda email por defecto
    rol: mapRolFromDb(r.rol),
    mesaId: r.mesa_id,
    mesaNombre: r.mesas?.nombre ?? null,
    activo: r.activo,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
  }));
  return { data: mapped, count: count ?? mapped.length };
}

export async function getUserById(supabase: SupabaseClient, id: string): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, rol, mesa_id, activo, creado_en, actualizado_en, mesas(nombre)')
    .eq('id', id)
    .single();
  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null;
    throw error;
  }
  const r = data as unknown as {
    id: string;
    full_name: string;
    rol: string;
    mesa_id: number | null;
    activo: boolean;
    creado_en: string;
    actualizado_en: string;
    mesas: { nombre: string } | null;
  };
  return {
    id: r.id,
    fullName: r.full_name,
    email: '',
    rol: mapRolFromDb(r.rol),
    mesaId: r.mesa_id,
    mesaNombre: r.mesas?.nombre ?? null,
    activo: r.activo,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
  };
}

// Crear usuario (RF-27): intenta admin.createUser (service_role). Si no hay privilegio, lanza error con hint.
export async function createUser(
  supabase: SupabaseClient,
  input: CreateUserInput,
): Promise<{ id: string }> {
  const errs = validateCreateUser(input);
  if (Object.keys(errs).length) throw new Error(`Validación: ${JSON.stringify(errs)}`);

  // Intento 1: API admin (requiere service_role / Edge Function con service key)
  // supabase-js expone auth.admin.createUser solo si el cliente fue creado con service_role
  const adminAny = (supabase.auth as unknown as { admin?: { createUser: (p: unknown) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> } }).admin;
  if (adminAny?.createUser) {
    const { data, error } = await adminAny.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName.trim(), rol: mapRolToDb(input.rol) },
    });
    if (!error && data.user) {
      // El trigger handle_new_user crea el profile; ahora actualizamos mesa_id si se pasó
      if (input.mesaId !== null) {
        const { error: upErr } = await supabase.from('profiles').update({ mesa_id: input.mesaId }).eq('id', data.user.id);
        if (upErr) throw upErr;
      }
      return { id: data.user.id };
    }
    // Si error es por permisos, caemos al throw con hint
    if (error && /not.*admin|service_role|unauthorized/i.test(error.message)) {
      throw new Error(
        `No autorizado para crear usuarios con anon key. Despliega Edge Function con service_role o usa invitación. Detalle: ${error.message}`,
      );
    }
    if (error) throw new Error(error.message);
  }

  // Fallback sin privilegios: no podemos crear auth.users desde anon. Error guiado.
  throw new Error(
    'Crear usuario requiere service_role (Edge Function). Implementa POST /functions/v1/admin-create-user con service_role y llama supabase.functions.invoke.',
  );
}

export async function updateUser(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateUserInput,
): Promise<void> {
  const errs = validateUpdateUser(patch);
  if (Object.keys(errs).length) throw new Error(`Validación: ${JSON.stringify(errs)}`);
  const payload: Record<string, unknown> = {};
  if (patch.fullName !== undefined) payload.full_name = patch.fullName.trim();
  if (patch.rol !== undefined) payload.rol = mapRolToDb(patch.rol);
  if (patch.mesaId !== undefined) payload.mesa_id = patch.mesaId;
  if (patch.activo !== undefined) payload.activo = patch.activo;
  payload.actualizado_en = new Date().toISOString();
  const { error } = await supabase.from('profiles').update(payload).eq('id', id);
  if (error) throw error;
}

export async function setUserActivo(supabase: SupabaseClient, id: string, activo: boolean): Promise<void> {
  return updateUser(supabase, id, { activo });
}

// Catálogo de mesas para selects (reutiliza tipo Mesa de tickets.ts)
export async function listMesas(supabase: SupabaseClient): Promise<Mesa[]> {
  const { data, error } = await supabase.from('mesas').select('id, nombre, activa').order('nombre');
  if (error) throw error;
  return (data ?? []) as Mesa[];
}
