import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, rawSupabaseUrl, rawSupabaseAnonKey } from './supabaseConfig';
export type VerificationResult = 'success' | 'expired' | 'invalid' | 'failed' | 'unconfigured';

export function isEmailVerificationCallback(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  return hash.get('type') === 'signup' || hash.has('error') || hash.has('error_code') || url.searchParams.has('error') || url.searchParams.has('error_code');
}

export async function verifyEmailCallback(href: string): Promise<VerificationResult> {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const error = hash.get('error') || url.searchParams.get('error');
  const code = hash.get('error_code') || url.searchParams.get('error_code');
  if (error || code) return code === 'otp_expired' ? 'expired' : 'invalid';
  const token = hash.get('access_token');
  // Supabase has verified the email before redirecting. Check the resulting
  // token with Auth, without adopting or persisting the callback's session.
  if (hash.get('type') !== 'signup' || !token) return 'invalid';
  if (!isSupabaseConfigured) return 'unconfigured';
  try {
    const client = createClient(rawSupabaseUrl, rawSupabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'study-pet-email-verification' },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000), cache: 'no-store' }) },
    });
    const { data, error: lookupError } = await client.auth.getUser(token);
    if (lookupError) return (lookupError.status && lookupError.status >= 500) || lookupError.name === 'AuthRetryableFetchError' ? 'failed' : 'invalid';
    return data.user?.email_confirmed_at ? 'success' : 'invalid';
  } catch { return 'failed'; }
}
