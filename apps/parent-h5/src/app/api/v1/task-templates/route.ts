import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, familyId } = await parentContext(request);
    const { data, error } = await db.from('task_templates').select('*').eq('family_id', familyId).order('created_at', { ascending: false });
    if (error) throw new ApiError(503, 'Templates unavailable');
    return reply({ templates: data });
  } catch (error) { return failure(error); }
}
