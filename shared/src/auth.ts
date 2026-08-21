// RF-04 + RF-05 — Helpers de autenticación y perfil
// El perfil es la fuente de verdad del rol (public.profiles), no el JWT.

import type { RolUsuario } from './types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRolUsuario } from './roles.js';

export type Profile = {
  id: string;
  email: string;
  nombre: string | null;
  rol: RolUsuario;
  mesa_id: string | null;
  activo: boolean;
  created_at: string;
};

export type AuthState = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
};

// Lee el perfil desde public.profiles por id de auth
export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nombre, rol, mesa_id, activo, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  // Guard de rol por si la DB tiene valor inesperado
  if (!isRolUsuario(data.rol)) {
    throw new Error(`Rol inválido en DB: ${data.rol}`);
  }
  return data as Profile;
}

// Conviene para guards: obtiene sesión + perfil en un paso
export async function getSessionProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return fetchProfile(supabase, session.user.id);
}
