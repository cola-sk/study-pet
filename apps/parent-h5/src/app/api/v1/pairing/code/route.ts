import { NextRequest } from 'next/server';
import { ApiError, failure, parentContext, reply } from '../../../../../server/api';
import { digestCode, makeCode, pairingKey } from '../../../../../server/pairing';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, familyId, parentId, userId } = await parentContext(request);
    const key = pairingKey();
    const existing = await db.from('parent_pairing_codes').select('nonce,format_version').eq('parent_id', parentId).maybeSingle();
    if (existing.error) throw new ApiError(503, 'Pairing code unavailable');
    let nonce = existing.data?.format_version === 2 ? existing.data.nonce : 0;
    for (let attempt = 0; attempt < 32; attempt++, nonce++) {
      const code = makeCode(key, userId, nonce);
      const { error } = await db.from('parent_pairing_codes').upsert({ parent_id: parentId, family_id: familyId, code_hash: digestCode(key, code), nonce, format_version: 2 }, { onConflict: 'parent_id' });
      if (!error) return reply({ code });
      if (error.code !== '23505') throw new ApiError(503, 'Pairing code unavailable');
    }
    throw new ApiError(503, 'Could not allocate a unique pairing code');
  } catch (error) { return failure(error); }
}
