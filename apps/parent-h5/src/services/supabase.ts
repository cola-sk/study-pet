import { createClient } from '@supabase/supabase-js';

export const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  rawSupabaseUrl && 
  rawSupabaseAnonKey && 
  rawSupabaseUrl.startsWith('https://') &&
  !rawSupabaseUrl.includes('placeholder')
);

export const supabase = isSupabaseConfigured
  ? createClient(rawSupabaseUrl, rawSupabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
