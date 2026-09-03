// Cliente Supabase para web — lee de EXPO_PUBLIC_* (expo start --web también las expone)

import { createClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@helpdesk/shared';

declare const process: { env: Record<string, string | undefined> };
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigError =
  !url || !anonKey
    ? 'Falta EXPO_PUBLIC_SUPABASE_URL / ANON_KEY. Copia .env.example a .env y haz rebuild: docker compose up --build'
    : null;

if (supabaseConfigError) {
  console.warn('[supabase]', supabaseConfigError, { url: url || '(vacío)' });
}

// No rompe el bundle si faltan env (evita pantalla blanca en Docker)
export const supabase = (() => {
  try {
    return createSupabaseClient({ url: url || 'https://placeholder.supabase.co', anonKey: anonKey || 'placeholder' });
  } catch {
    // Fallback dummy que no crashea el render
    return createClient('https://placeholder.supabase.co', 'placeholder') as ReturnType<typeof createSupabaseClient>;
  }
})();
