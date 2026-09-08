// RF-27 / RF-28 — Administración de usuarios (solo administrador)
// Contrato espejo de supabase/migrations/*_schema_inicial.sql y handle_new_user
import type { RolUsuario } from './types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mesa } from './tickets.js';
import { ROLES, isRolUsuario } from './roles.js';
import { validatePasswordSync } from './password.js';

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
  email?: string;
  password?: string;
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
  if (input.email !== undefined && !isEmail(input.email.trim())) e.email = 'Email inválido';
  if (input.password !== undefined) {
    const v = validatePasswordSync(input.password, { email: input.email, nombre: input.fullName, rol: input.rol });
    if (!v.ok) e.password = v.reasons[0] ?? 'Contraseña no cumple requisitos';
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

// Crear usuario (RF-27): vía Edge Function admin-create-user (service_role).
// Fallback: intenta auth.admin.createUser si el cliente tiene service_role (local/dev).
export async function createUser(
  supabase: SupabaseClient,
  input: CreateUserInput,
): Promise<{ id: string }> {
  const errs = validateCreateUser(input);
  if (Object.keys(errs).length) throw new Error(`Validación: ${JSON.stringify(errs)}`);

  const payload = {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    password: input.password,
    rol: input.rol,
    mesaId: input.mesaId,
  };

  // Intento 1: Edge Function (producción + local con service_role)
  try {
    const { data, error } = await supabase.functions.invoke('admin-create-user', { body: payload });
    if (!error && data) {
      const d = data as { id?: string; error?: string; details?: unknown };
      if (d.id) return { id: d.id };
      if (d.error) throw new Error(typeof d.details === 'object' ? `${d.error}: ${JSON.stringify(d.details)}` : d.error);
    }
    // Si error es 404 (función no desplegada en local), caemos a fallback auth.admin
    if (error && !/FunctionsHttpError|not found|Failed to send/i.test((error as Error).message ?? '')) {
      // Errores de validación 400/409 vienen como error con context
      const msg = (error as { message?: string }).message ?? String(error);
      // Si es 409 duplicado, propagar claro
      if (/already|duplicate|409/i.test(msg)) throw new Error('Email ya registrado');
      // Si es validación 400 con details, ya se manejó arriba; si no, re-throw
      if (!/Failed to send a request to the Edge Function/i.test(msg)) throw new Error(msg);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Validación|Email ya registrado|Solo administrador|Token inválido/i.test(msg)) throw e;
    // network / not-found -> intentar fallback
  }

  // Intento 2: auth.admin.createUser (solo si supabase client tiene service_role, ej: tests / supa local con key directa)
  const adminAny = (supabase.auth as unknown as { admin?: { createUser: (p: unknown) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> } }).admin;
  if (adminAny?.createUser) {
    const { data, error } = await adminAny.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: payload.fullName, rol: mapRolToDb(payload.rol as RolUsuario) },
    });
    if (!error && data.user) {
      if (payload.mesaId !== null) {
        const { error: upErr } = await supabase.from('profiles').update({ mesa_id: payload.mesaId }).eq('id', data.user.id);
        if (upErr) throw upErr;
      }
      return { id: data.user.id };
    }
    if (error && /not.*admin|service_role|unauthorized/i.test(error.message)) {
      throw new Error(`No autorizado para crear usuarios con anon key. Despliega Edge Function admin-create-user. Detalle: ${error.message}`);
    }
    if (error) throw new Error(error.message);
  }

  throw new Error('Crear usuario requiere Edge Function admin-create-user (service_role). Despliega con supabase functions deploy admin-create-user.');
}

export async function updateUser(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateUserInput,
): Promise<void> {
  const errs = validateUpdateUser(patch);
  if (Object.keys(errs).length) throw new Error(`Validación: ${JSON.stringify(errs)}`);
  // Si cambia email o password, intentar vía Edge Function admin-update-user / auth.admin
  if (patch.email !== undefined || patch.password !== undefined) {
    const authPatch: Record<string, string> = {};
    if (patch.email !== undefined) authPatch.email = patch.email.trim();
    if (patch.password !== undefined) authPatch.password = patch.password;
    // Intento Edge Function (service_role)
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-user', { body: { id, ...authPatch } });
      if (!error && data) {
        const d = data as { error?: string };
        if (d.error) throw new Error(d.error);
      } else if (error && !/FunctionsHttpError|not found|Failed to send/i.test((error as Error).message ?? '')) {
        throw error;
      } else {
        // Fallback directo auth.admin si está disponible (tests / local service_role)
        const adminAny = (supabase.auth as unknown as { admin?: { updateUserById: (uid: string, p: unknown) => Promise<{ error: { message: string } | null }> } }).admin;
        if (adminAny?.updateUserById) {
          const { error: admErr } = await adminAny.updateUserById(id, authPatch);
          if (admErr) throw new Error(admErr.message);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Validación/i.test(msg)) throw e;
      // Si falla Edge/auth pero solo era email/password, propagar; si hay además cambios de profile, continuar con profile update
      if (patch.fullName === undefined && patch.rol === undefined && patch.mesaId === undefined && patch.activo === undefined) throw e;
    }
  }
  const payload: Record<string, unknown> = {};
  if (patch.fullName !== undefined) payload.full_name = patch.fullName.trim();
  if (patch.rol !== undefined) payload.rol = mapRolToDb(patch.rol);
  if (patch.mesaId !== undefined) payload.mesa_id = patch.mesaId;
  if (patch.activo !== undefined) payload.activo = patch.activo;
  // Si solo era cambio de auth (email/password) sin campos de profile, no hacer update vacío
  if (Object.keys(payload).length === 0) return;
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
