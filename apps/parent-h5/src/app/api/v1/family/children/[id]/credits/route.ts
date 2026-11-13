import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../../../server/api';
export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, familyId, parentId } = await parentContext(request);
    const body = await request.json().catch(() => null);
    if (!uuid.test(params.id) || !Number.isInteger(body?.amount) || body.amount < 1 || body.amount > 10000 ||
        typeof body.requestId !== 'string' || !uuid.test(body.requestId) ||
        (body.note !== undefined && (typeof body.note !== 'string' || body.note.trim().length > 200))) {
      throw new ApiError(400, '请输入 1–10000 的整数金币数量，备注不超过 200 字');
    }
    const { data, error } = await db.rpc('grant_parent_credits', {
      p_family_id: familyId, p_parent_id: parentId, p_child_id: params.id,
      p_amount: body.amount, p_request_id: body.requestId, p_note: body.note?.trim() || '',
    });
    if (error) {
      if (error.code === 'P0002') throw new ApiError(404, '未找到孩子档案');
      if (error.code === '23505') throw new ApiError(409, '本次奖励信息发生变化，请刷新后重试');
      if (error.code === '22003') throw new ApiError(409, '金币余额已达到上限');
      throw new ApiError(503, '奖励暂时无法发放，请稍后重试');
    }
    return reply(data);
  } catch (error) { return failure(error); }
}
