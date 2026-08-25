// RF-04 + RF-05 — Helpers de autenticación y perfil
// El perfil es la fuente de verdad del rol (public.profiles), no el JWT.

import type { RolUsuario } from './types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRolUsuario } from './roles.js';

export type Profile = {
  id: string;
  // public.profiles usa full_name / mesa_id / creado_en (schema_inicial.sql:29)
  full_name: string | null;
  // compat: algunos callers esperan `nombre` — se mapea desde full_name
  nombre: string | null;
  email: string | null;
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
    .select('id, full_name, rol, mesa_id, activo, creado_en')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (!isRolUsuario((data as unknown as { rol: unknown }).rol)) {
    throw new Error(`Rol inválido en DB: ${(data as unknown as { rol: unknown }).rol}`);
  }
  const row = data as unknown as { id: string; full_name: string | null; rol: RolUsuario; mesa_id: number | null; activo: boolean; creado_en: string };
  // Intenta enriquecer email desde auth si está disponible (no crítico)
  let email: string | null = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id === userId) email = sessionData.session.user.email ?? null;
  } catch {
    // ignorar
  }
  return {
    id: row.id,
    full_name: row.full_name,
    nombre: row.full_name,
    email,
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
