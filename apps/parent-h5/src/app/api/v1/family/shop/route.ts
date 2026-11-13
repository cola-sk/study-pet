import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../server/api';
import { shopInput, shopFields, shopFailure } from '../../../../../server/shop';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, familyId } = await parentContext(request);
    const { data, error } = await db.from('family_shop_items').select(shopFields).eq('family_id', familyId).eq('archived', false).order('builtin_key', { ascending: false, nullsFirst: false }).order('created_at').order('id');
    if (error) throw new ApiError(503, '商品目录暂时无法加载');
    return reply({ items: data, limit: 10 });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const { db, familyId } = await parentContext(request);
    const input = shopInput(await request.json().catch(() => null));
    const { data, error } = await db.from('family_shop_items').insert({ ...input, family_id: familyId }).select(shopFields).single();
    if (error) shopFailure(error);
    return reply({ item: data }, 201);
  } catch (error) { return failure(error); }
}
