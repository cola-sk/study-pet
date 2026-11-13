import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../server/api';
import { taskInput, taskFailure, taskTemplateFields } from '../../../../server/tasks';
import { uuid } from '../../../../server/shop';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, familyId } = await parentContext(request);
    const { data, error } = await db.from('task_templates').select(taskTemplateFields).eq('family_id', familyId).eq('archived', false).order('created_at', { ascending: false });
    if (error) throw new ApiError(503, 'Templates unavailable');
    return reply({ templates: data });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const { db, familyId } = await parentContext(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.requestId !== 'string' || !uuid.test(body.requestId)) throw new ApiError(400, '保存请求 ID 无效');
    const input = taskInput(body);
    const { data, error } = await db.rpc('save_family_task_template', { p_family_id: familyId, p_template_id: null, p_request_id: body.requestId, p_input: input });
    if (error) taskFailure(error);
    return reply({ template: data }, 201);
  } catch (error) { return failure(error); }
}
