import { NextRequest } from 'next/server';
import { ApiError, deviceContext, failure, reply } from '../../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, device } = await deviceContext(request);
    const { data, error } = await db.from('family_shop_items').select('id,name,price,action,updated_at').eq('family_id', device.family_id).eq('archived', false).order('builtin_key', { ascending: false, nullsFirst: false }).order('created_at').order('id');
    if (error || data.length > 10) throw new ApiError(503, 'Shop unavailable');
    return reply({ items: data });
  } catch (error) { return failure(error); }
}
