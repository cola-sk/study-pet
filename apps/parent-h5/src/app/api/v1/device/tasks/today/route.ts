import { NextRequest } from 'next/server';
import { ApiError, deviceContext, failure, reply } from '../../../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, device } = await deviceContext(request);
    const { data: family, error: familyError } = await db.from('families').select('timezone').eq('id', device.family_id).single();
    if (familyError || !family) throw new ApiError(503, 'Family settings unavailable');
    let today: string;
    try { today = new Intl.DateTimeFormat('en-CA', { timeZone: family.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch { throw new ApiError(503, 'Invalid family timezone'); }
    const { data, error } = await db.from('task_instances').select('id,title,description,reward_coins,confirm_type,status,target_date')
      .eq('family_id', device.family_id).eq('child_id', device.child_id).eq('target_date', today).order('created_at');
    if (error) throw new ApiError(503, 'Tasks unavailable');
    return reply({ date: today, tasks: data });
  } catch (error) { return failure(error); }
}
