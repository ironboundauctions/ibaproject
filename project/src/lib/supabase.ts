import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function hasSupabaseCredentials(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

export const supabase = hasSupabaseCredentials()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'x-client-info': 'supabase-js-web',
        },
      },
      // Set aggressive timeout
      realtime: {
        timeout: 5000,
      },
    })
  : null;