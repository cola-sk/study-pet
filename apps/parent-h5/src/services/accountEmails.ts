import { supabase } from './supabase';
import { emailVerificationUrl, passwordResetUrl } from './supabaseConfig';
export async function sendAccountEmail(kind: 'forgot' | 'resend', email: string): Promise<void> {
  if (!supabase) throw new Error('登录服务尚未配置');
  const result = kind === 'forgot'
    ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: passwordResetUrl })
    : await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: emailVerificationUrl } });
  if (result.error) throw new Error(result.error.status === 429 ? '邮件发送较频繁，请稍后再试。' : '邮件暂时无法发送，请检查邮箱格式或稍后重试。');
}
