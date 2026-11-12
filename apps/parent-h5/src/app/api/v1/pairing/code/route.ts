import { createHash, createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ApiError, failure, parentContext, reply } from '../../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, familyId, parentId, userId } = await parentContext(request);
    const secret = process.env.PAIRING_CODE_SECRET;
    if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new ApiError(503, 'Pairing service is not configured');
    const code = createHmac('sha256', Buffer.from(secret, 'hex')).update(`study-pet-pair-v1:${userId}`).digest('hex').slice(0, 20);
    const codeHash = createHash('sha256').update(code).digest('hex');
    const { error } = await db.from('parent_pairing_codes').upsert({ parent_id: parentId, family_id: familyId, code_hash: codeHash }, { onConflict: 'parent_id' });
    if (error) throw new ApiError(503, 'Pairing code unavailable');
    return reply({ code: code.toUpperCase().match(/.{4}/g)?.join('-') });
  } catch (error) { return failure(error); }
}
