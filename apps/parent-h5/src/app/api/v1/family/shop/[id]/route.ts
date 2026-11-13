import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../../server/api';
import { shopInput, shopFields, shopFailure, uuid } from '../../../../../../server/shop';
export const dynamic = 'force-dynamic';
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, familyId } = await parentContext(request);
    if (!uuid.test(params.id)) throw new ApiError(400, 'Invalid item');
    const input = shopInput(await request.json().catch(() => null));
    const { data, error } = await db.from('family_shop_items').update(input).eq('id', params.id).eq('family_id', familyId).eq('archived', false).select(shopFields).maybeSingle();
    if (error) shopFailure(error);
    if (!data) throw new ApiError(404, '商品已删除或不可用');
    return reply({ item: data });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, familyId } = await parentContext(request);
    if (!uuid.test(params.id)) throw new ApiError(400, 'Invalid item');
    const { data, error } = await db.from('family_shop_items').update({ archived: true }).eq('id', params.id).eq('family_id', familyId).is('builtin_key', null).eq('archived', false).select('id').maybeSingle();
    if (error) shopFailure(error);
    if (!data) throw new ApiError(404, '商品不存在或属于不可删除的内置商品');
    return reply({ success: true });
  } catch (error) { return failure(error); }
}
