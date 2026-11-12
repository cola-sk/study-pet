import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError, database, failure, reply } from '../../../../../server/api';
export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 2048) throw new ApiError(413, 'Request too large');
    const body = await request.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code.replace(/-/g, '').toLowerCase() : '';
    const token = body?.deviceToken;
    if (!/^[a-f0-9]{20}$/.test(code) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(400, 'Invalid pairing request');
    const codeHash = createHash('sha256').update(code).digest('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const db = database();
    const { data, error } = await db.rpc('pair_device_to_family', { p_code_hash: codeHash, p_token_hash: tokenHash });
    if (error) throw new ApiError(503, 'Pairing unavailable');
    if (!data?.success) throw new ApiError(403, 'Pairing failed');
    return reply({ paired: true, childAssigned: data.child_assigned === true });
  } catch (error) { return failure(error); }
}
