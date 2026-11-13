import { NextRequest } from 'next/server';
import { ApiError, deviceContext, failure, reply } from '../../../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, device } = await deviceContext(request);
    const offsetText = request.nextUrl.searchParams.get('offset') || '0';
    if (!/^\d{1,6}$/.test(offsetText)) throw new ApiError(400, 'Invalid offset');
    const offset = Number(offsetText);
    const generated = await db.rpc('ensure_today_tasks', { p_family_id: device.family_id });
    if (generated.error || typeof generated.data !== 'string') throw new ApiError(503, 'Tasks unavailable');
    const today = generated.data;
    const [list, done] = await Promise.all([
      db.from('task_instances').select('id,title,description,reward_coins,confirm_type,status,target_date,reject_reason,reward_granted', { count: 'exact' }).eq('family_id', device.family_id).eq('child_id', device.child_id).eq('target_date', today).order('created_at').order('id').range(offset, offset + 9),
      db.from('task_instances').select('id', { count: 'exact', head: true }).eq('family_id', device.family_id).eq('child_id', device.child_id).eq('target_date', today).eq('status', 'completed'),
    ]);
    if (list.error || done.error) throw new ApiError(503, 'Tasks unavailable');
    return reply({ childId: device.child_id, date: today, tasks: list.data, total: list.count, completed: done.count, offset });
  } catch (error) { return failure(error); }
}
