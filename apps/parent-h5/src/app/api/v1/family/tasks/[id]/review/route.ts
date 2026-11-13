import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../../../server/api';
import { uuid } from '../../../../../../../server/shop';
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, familyId, parentId } = await parentContext(request);
    if (!uuid.test(params.id)) throw new ApiError(400, '任务 ID 无效');
    const body = await request.json().catch(() => null);
    if (!body || !['approve', 'reject'].includes(body.action) || (body.action === 'reject' && (typeof body.reason !== 'string' || !body.reason.trim() || [...body.reason.trim()].length > 120))) throw new ApiError(400, '请选择审批结果，鼓励提示限 1–120 字');
    const { data, error } = await db.rpc('review_family_task', { p_family_id: familyId, p_parent_id: parentId, p_task_id: params.id, p_action: body.action, p_reason: body.reason?.trim() || null });
    if (error) throw new ApiError(503, '审批暂时不可用，请重试');
    if (!data?.success) throw new ApiError(409, '任务状态已变更，请刷新后重试');
    return reply(data);
  } catch (error) { return failure(error); }
}
