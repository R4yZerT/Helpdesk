// Cliente Supabase para web — lee de EXPO_PUBLIC_* (expo start --web también las expone)

import { createSupabaseClient } from '@helpdesk/shared';

declare const process: { env: Record<string, string | undefined> };
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createSupabaseClient({ url, anonKey });
