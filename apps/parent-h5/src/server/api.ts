import 'server-only';
import { createHash } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function failure(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Device API failed', error instanceof Error ? error.message : 'unexpected error');
  return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
}
export function database(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError(503, 'Server database is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } });
}
function bearer(request: NextRequest): string {
  const value = request.headers.get('authorization');
  const match = value?.match(/^Bearer ([^\s]+)$/i);
  if (!match) throw new ApiError(401, 'Authentication required');
  return match[1];
}
export async function deviceContext(request: NextRequest, allowUnassigned = false) {
  const token = bearer(request);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401, 'Invalid device credential');
  const db = database();
  const hash = createHash('sha256').update(token).digest('hex');
  const { data, error } = await db.from('devices').select('id,family_id,child_id,status,binding_version,alias').eq('api_token_hash', hash).maybeSingle();
  if (error) throw new ApiError(503, 'Device lookup unavailable');
  if (!data || !data.family_id || !['paired', 'unassigned'].includes(data.status)) throw new ApiError(401, 'Device is not paired');
  if (!allowUnassigned && (data.status !== 'paired' || !data.child_id)) throw new ApiError(401, 'Device is not paired');
  return { db, device: data };
}
export async function authenticatedContext(request: NextRequest) {
  const token = bearer(request);
  const db = database();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'Invalid or expired login');
  return { db, user: data.user };
}
export async function parentContext(request: NextRequest) {
  const { db, user } = await authenticatedContext(request);
  const result = await db.from('parents').select('id,family_id').eq('auth_user_id', user.id).maybeSingle();
  if (result.error) throw new ApiError(503, 'Parent lookup unavailable');
  if (!result.data?.family_id) throw new ApiError(403, 'Parent is not assigned to a family');
  return { db, familyId: result.data.family_id as string, parentId: result.data.id as string, userId: user.id };
}
export const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
