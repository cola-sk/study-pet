import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../../server/api';
import { profileName, uuidPattern } from '../../../../../../server/management';
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!uuidPattern.test(params.id)) throw new ApiError(400, '无效的宝贝编号');
    const { db, familyId } = await parentContext(request);
    const body = await request.json().catch(() => null);
    const nickname = profileName(body?.nickname, '宝贝昵称');
    const petName = profileName(body?.petName, '宠物昵称');
    const { data, error } = await db.from('children').update({ nickname, pet_name: petName, updated_at: new Date().toISOString() })
      .eq('id', params.id).eq('family_id', familyId).select('id,nickname,pet_name,coins_balance,avatar_url').maybeSingle();
    if (error) throw new ApiError(503, '暂时无法保存昵称，请稍后重试');
    if (!data) throw new ApiError(404, '宝贝不存在，请刷新列表');
    return reply({ child: data });
  } catch (error) { return failure(error); }
}
