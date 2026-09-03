// Cliente Supabase para mobile — lee de EXPO_PUBLIC_* (definir en .env)
// RF-04 — SecureStore cifrado cumple OWASP M2 / NIST confidencialidad

import { createClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@helpdesk/shared';
import { secureStorage } from './secure-storage';

declare const process: { env: Record<string, string | undefined> };
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigError =
  !url || !anonKey ? 'Falta EXPO_PUBLIC_SUPABASE_URL / ANON_KEY en .env' : null;

if (supabaseConfigError) console.warn('[supabase]', supabaseConfigError);

export const supabase = (() => {
  try {
    return createSupabaseClient({
      url: url || 'https://placeholder.supabase.co',
      anonKey: anonKey || 'placeholder',
      storage: secureStorage,
    });
  } catch {
    return createClient('https://placeholder.supabase.co', 'placeholder') as ReturnType<typeof createSupabaseClient>;
  }
})();

// Re-export para uso directo
export type { SupabaseClient } from '@supabase/supabase-js';
