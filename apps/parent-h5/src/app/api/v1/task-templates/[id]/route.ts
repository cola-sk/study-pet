import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../server/api';
import { taskInput, taskFailure, taskTemplateFields, templateInput } from '../../../../../server/tasks';
import { uuid } from '../../../../../server/shop';
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, familyId } = await parentContext(request);
    if (!uuid.test(params.id)) throw new ApiError(400, '任务 ID 无效');
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new ApiError(400, '任务配置无效');
    const current = await db.from('task_templates').select(taskTemplateFields).eq('id', params.id).eq('family_id', familyId).eq('archived', false).maybeSingle();
    if (current.error) taskFailure(current.error);
    if (!current.data) throw new ApiError(404, '任务不存在或已移除');
    const input = taskInput({ ...templateInput(current.data), ...body });
    if (body.updatedAt !== undefined && (typeof body.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt)))) throw new ApiError(400, '任务版本无效');
    const { data, error } = await db.rpc('save_family_task_template', { p_family_id: familyId, p_template_id: params.id, p_request_id: null, p_input: input, p_expected_version: body.updatedAt || current.data.updated_at });
    if (error) taskFailure(error);
    return reply({ template: data });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, familyId } = await parentContext(request);
    if (!uuid.test(params.id)) throw new ApiError(400, '任务 ID 无效');
    const { data, error } = await db.rpc('archive_family_task_template', { p_family_id: familyId, p_template_id: params.id });
    if (error) taskFailure(error);
    if (!data) throw new ApiError(404, '任务不存在');
    return reply({ success: true });
  } catch (error) { return failure(error); }
}
