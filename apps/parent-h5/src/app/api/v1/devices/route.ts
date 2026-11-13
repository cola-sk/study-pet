import { NextRequest } from 'next/server';
import { ApiError, failure, parentContext, reply } from '../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, familyId } = await parentContext(request);
    const { data, error } = await db.from('devices').select('id,alias,child_id,status,last_seen_at,updated_at').eq('family_id', familyId).in('status', ['paired', 'unassigned']).order('created_at');
    if (error) throw new ApiError(503, 'Devices unavailable');
    return reply({ devices: data });
  } catch (error) { return failure(error); }
}
