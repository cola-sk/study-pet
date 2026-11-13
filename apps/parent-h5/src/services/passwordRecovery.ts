import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, rawSupabaseUrl, rawSupabaseAnonKey } from './supabaseConfig';

export type RecoveryStatus = 'invalid' | 'expired' | 'failed' | 'unconfigured';
export type PasswordSaveResult = 'success' | 'expired' | 'weak' | 'failed';
export type Recovery = { status: RecoveryStatus } | { status: 'ready'; userId: string; save: (password: string) => Promise<PasswordSaveResult> };
export function isPasswordRecoveryCallback(href: string): boolean {
  return new URLSearchParams(new URL(href).hash.slice(1)).get('type') === 'recovery';
}
export async function beginPasswordRecovery(href: string): Promise<Recovery> {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has('error') || hash.has('error_code') || url.searchParams.has('error') || url.searchParams.has('error_code')) {
    return { status: (hash.get('error_code') || url.searchParams.get('error_code')) === 'otp_expired' ? 'expired' : 'invalid' };
  }
  const access = hash.get('access_token'), refresh = hash.get('refresh_token');
  if (hash.get('type') !== 'recovery' || !access || !refresh) return { status: 'invalid' };
  if (!isSupabaseConfigured) return { status: 'unconfigured' };
  try {
    const client = createClient(rawSupabaseUrl, rawSupabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'study-pet-password-recovery' },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000), cache: 'no-store' }) },
    });
    const lookup = await client.auth.getUser(access);
    if (lookup.error) return { status: lookup.error.status && lookup.error.status >= 500 || lookup.error.name === 'AuthRetryableFetchError' ? 'failed' : 'expired' };
    if (!lookup.data.user?.id) return { status: 'invalid' };
    const session = await client.auth.setSession({ access_token: access, refresh_token: refresh });
    if (session.error || session.data.user?.id !== lookup.data.user.id) return { status: 'expired' };
    let complete = false;
    return {
      status: 'ready', userId: lookup.data.user.id,
      async save(password) {
        if (complete) return 'expired';
        if (password.length < 8 || password.length > 72) return 'weak';
        try {
          const { data, error } = await client.auth.updateUser({ password });
          if (error) return error.status === 401 || error.status === 403 ? 'expired' : error.code === 'weak_password' || error.code === 'same_password' ? 'weak' : 'failed';
          if (data.user?.id !== lookup.data.user.id) return 'failed';
          complete = true;
          // Password was saved even if this optional session-revocation request fails.
          await client.auth.signOut({ scope: 'global' }).catch(() => undefined);
          return 'success';
        } catch { return 'failed'; }
      },
    };
  } catch { return { status: 'failed' }; }
}
