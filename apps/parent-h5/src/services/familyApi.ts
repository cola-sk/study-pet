import { supabase } from './supabase';

export type FamilyChild = { id: string; nickname: string; coins_balance: number };
export type FamilyDevice = { id: string; alias: string; child_id: string | null; status: string; last_seen_at: string | null };

export async function familyApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabase) throw new Error('登录服务未配置');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('登录已过期，请重新登录');
  const response = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('请求失败，请检查网络或稍后重试');
  return body as T;
}
