import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../server/api';
import { taskTemplateFields } from '../../../../../server/tasks';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, familyId } = await parentContext(request);
    const generated = await db.rpc('ensure_today_tasks', { p_family_id: familyId });
    if (generated.error || typeof generated.data !== 'string') throw new ApiError(503, '任务生成服务暂时不可用');
    const [family, children, devices, templates, instances] = await Promise.all([
      db.from('families').select('id,name,timezone,created_at').eq('id', familyId).single(),
      db.from('children').select('id,family_id,nickname,coins_balance,avatar_url').eq('family_id', familyId).order('created_at'),
      db.from('devices').select('id,family_id,child_id,alias,status,device_model,firmware_version,last_seen_at').eq('family_id', familyId).order('created_at'),
      db.from('task_templates').select(taskTemplateFields).eq('family_id', familyId).eq('archived', false).order('created_at', { ascending: false }),
      db.from('task_instances').select('*').eq('family_id', familyId).or(`target_date.eq.${generated.data},status.eq.submitted`).order('target_date', { ascending: false }).order('created_at'),
    ]);
    if ([family, children, devices, templates, instances].some(result => result.error)) throw new ApiError(503, '任务数据暂时无法加载');
    return reply({ date: generated.data, family: family.data, children: children.data, devices: devices.data, templates: templates.data, instances: instances.data });
  } catch (error) { return failure(error); }
}
