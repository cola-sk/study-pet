// Public connection settings only. Importing this module never starts a session.
export const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
export const rawSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
export const isSupabaseConfigured = Boolean(rawSupabaseUrl && rawSupabaseAnonKey && rawSupabaseUrl.startsWith('https://') && !rawSupabaseUrl.includes('placeholder'));
export const EMAIL_VERIFICATION_PATH = '/auth/verified';
export const emailVerificationUrl = new URL(EMAIL_VERIFICATION_PATH, process.env.NEXT_PUBLIC_SITE_URL || 'https://keep.1203.fyi').href;
export const PASSWORD_RESET_PATH = '/auth/reset-password';
export const passwordResetUrl = new URL(PASSWORD_RESET_PATH, process.env.NEXT_PUBLIC_SITE_URL || 'https://keep.1203.fyi').href;
