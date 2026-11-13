import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError, database, failure, reply } from '../../../../../server/api';
import { digestCode, digestSource, pairingKey } from '../../../../../server/pairing';
export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 2048) throw new ApiError(413, 'Request too large');
    const body = await request.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const token = body?.deviceToken;
    if (!/^[0-9]{6}$/.test(code) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(400, 'Invalid pairing request');
    const key = pairingKey();
    // The global database limit remains effective even if a proxy header is absent or spoofed.
    const source = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown';
    const { data, error } = await database().rpc('pair_device_to_family', {
      p_code_hash: digestCode(key, code),
      p_token_hash: createHash('sha256').update(token).digest('hex'),
      p_source_hash: digestSource(key, source.slice(0, 128)),
    });
    if (error) throw new ApiError(503, 'Pairing unavailable');
    if (!data?.success) throw new ApiError(403, 'Pairing failed or temporarily limited');
    return reply({ paired: true, childAssigned: data.child_assigned === true });
  } catch (error) { return failure(error); }
}
