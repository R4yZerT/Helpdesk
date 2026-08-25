// Cliente Supabase para mobile — lee de EXPO_PUBLIC_* (definir en .env)
// RF-04 — SecureStore cifrado cumple OWASP M2 / NIST confidencialidad

import { createSupabaseClient } from '@helpdesk/shared';
import { secureStorage } from './secure-storage';

declare const process: { env: Record<string, string | undefined> };
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createSupabaseClient({ url, anonKey, storage: secureStorage });

// Re-export para uso directo
export type { SupabaseClient } from '@supabase/supabase-js';
