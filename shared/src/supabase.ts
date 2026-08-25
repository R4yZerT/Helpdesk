// Cliente Supabase — factory sin hardcodear credenciales.
// Las apps inyectan URL y anon key desde env (EXPO_PUBLIC_ / VITE_).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Tipos mínimos para el esquema HelpDesk (se amplían con RFs futuros)
export type SupabaseOptions = {
  url: string;
  anonKey: string;
  // RF-04 — storage cifrado opcional (mobile: SecureStore, web: localStorage)
  // Calidades: Seguridad (cifrado) + Disponibilidad (persistencia)
  storage?: {
    getItem: (key: string) => Promise<string | null> | string | null;
    setItem: (key: string, value: string) => Promise<void> | void;
    removeItem: (key: string) => Promise<void> | void;
  };
};

export function createSupabaseClient(options: SupabaseOptions): SupabaseClient {
  if (!options.url || !options.anonKey) {
    throw new Error(
      'Supabase URL y anonKey son requeridos. Configura EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY',
    );
  }
  return createClient(options.url, options.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: options.storage as unknown as undefined,
    },
  });
}

// Singleton lazy para apps que importan sin factory (útil en web)
let singleton: SupabaseClient | null = null;

export function getSupabaseClient(options?: SupabaseOptions): SupabaseClient {
  if (singleton) return singleton;
  if (!options) {
    throw new Error('Supabase no inicializado. Llama getSupabaseClient({ url, anonKey }) primero.');
  }
  singleton = createSupabaseClient(options);
  return singleton;
}
