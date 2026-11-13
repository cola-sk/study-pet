import { createClient } from '@supabase/supabase-js';
import { rawSupabaseUrl, rawSupabaseAnonKey, isSupabaseConfigured } from './supabaseConfig';
export { rawSupabaseUrl, rawSupabaseAnonKey, isSupabaseConfigured } from './supabaseConfig';

export const supabase = isSupabaseConfigured
  ? createClient(rawSupabaseUrl, rawSupabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
