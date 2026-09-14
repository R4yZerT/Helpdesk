// RF-04 + RF-05 — Helpers de autenticación y perfil
// El perfil es la fuente de verdad del rol (public.profiles), no el JWT.

import type { RolUsuario } from './types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRolUsuario } from './roles.js';

export type Profile = {
  id: string;
  full_name: string | null;
  nombre: string | null;
  email: string | null;
  cedula: string | null;
  telefono: string | null;
  avatar_url: string | null;
  rol: RolUsuario;
  mesa_id: number | null;
  activo: boolean;
  creado_en: string;
};

export type AuthState = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
};

// Lee el perfil desde public.profiles por id de auth
// Esquema real: id, full_name, rol, mesa_id, activo, creado_en (+ email via auth.users join si existe)
export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, rol, mesa_id, activo, creado_en, cedula, telefono, avatar_url, email')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (!isRolUsuario((data as unknown as { rol: unknown }).rol)) {
    throw new Error(`Rol inválido en DB: ${(data as unknown as { rol: unknown }).rol}`);
  }
  const row = data as unknown as { id: string; full_name: string | null; rol: RolUsuario; mesa_id: number | null; activo: boolean; creado_en: string; cedula: string | null; telefono: string | null; avatar_url: string | null; email: string | null };
  let email: string | null = (row as any).email ?? null;
  try {
    if (!email) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user?.id === userId) email = sessionData.session.user.email ?? null;
    }
  } catch {}

  return {
    id: row.id,
    full_name: row.full_name,
    nombre: row.full_name,
    email,
    cedula: row.cedula ?? null,
    telefono: row.telefono ?? null,
    avatar_url: row.avatar_url ?? null,
    rol: row.rol,
    mesa_id: row.mesa_id,
    activo: row.activo,
    creado_en: row.creado_en,
  };
}

// Conviene para guards: obtiene sesión + perfil en un paso
export async function getSessionProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return fetchProfile(supabase, session.user.id);
}

// RF-27 — actualización Mi Perfil (nombre/correo/teléfono + avatar_url editables por el propio usuario; RLS profiles_update_own lo limita)
export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: { full_name?: string | null; email?: string | null; telefono?: string | null; avatar_url?: string | null },
): Promise<Profile | null> {
  const clean: Record<string, string | null> = {};
  if ('full_name' in patch) {
    const v = patch.full_name?.trim();
    if (!v) throw new Error('Nombre requerido');
    clean.full_name = v;
  }
  if ('email' in patch) {
    const v = patch.email?.trim();
    if (!v) throw new Error('Correo requerido');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error('Formato de correo inválido');
    clean.email = v;
  }
  if ('telefono' in patch) clean.telefono = patch.telefono?.trim() ? patch.telefono.trim() : null;
  if ('avatar_url' in patch) clean.avatar_url = patch.avatar_url?.trim() ? patch.avatar_url.trim() : null;
  if (Object.keys(clean).length === 0) return fetchProfile(supabase, userId);
  const { error } = await (supabase.from('profiles') as any).update(clean).eq('id', userId);
  if (error) throw error;
  // Sincronizar espejo en auth.users (lo que muestra el dashboard de Supabase):
  // el propio usuario sí puede actualizar su metadata (best-effort, no bloquea si falla)
  // Causa conocida: sin esto, Authentication → Users conserva el nombre/correo anterior
  if ('full_name' in patch && clean.full_name) {
    try { await supabase.auth.updateUser({ data: { full_name: clean.full_name } }); } catch {}
  }
  // Si se cambió el email, también intentar actualizar auth.users.email (best-effort, puede requerir confirmación)
  if ('email' in patch && clean.email) {
    try { await supabase.auth.updateUser({ email: clean.email }); } catch {}
  }
  return fetchProfile(supabase, userId);
}

export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File | Blob,
  fileName: string,
): Promise<string> {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'avatar.jpg';
  const path = `${userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from('avatares').upload(path, file as any, { upsert: false, contentType: (file as any).type || 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('avatares').getPublicUrl(path);
  const url = data.publicUrl;
  await updateProfile(supabase, userId, { avatar_url: url });
  return url;
}
