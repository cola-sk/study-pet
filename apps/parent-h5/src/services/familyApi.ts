import { supabase } from './supabase';

export type FamilyChild = {
  id: string; nickname: string; pet_name?: string; coins_balance: number; avatar_url?: string | null;
  pet?: { food_count: number; water_count: number } | null;
  devices?: { id: string; alias: string }[];
};
export type FamilyDevice = { id: string; alias: string; child_id: string | null; status: string; last_seen_at: string | null; updated_at: string };
export class FamilyApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function familyApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabase) throw new Error('登录服务未配置');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('登录已过期，请重新登录');
  const response = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    cache: 'no-store', signal: init.signal || AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new FamilyApiError(response.status === 401 ? '登录已过期，请重新登录' : response.status >= 500 ? '服务暂时不可用，请稍后重试' : body.error || '请求失败，请稍后重试', response.status);
  return body as T;
}
