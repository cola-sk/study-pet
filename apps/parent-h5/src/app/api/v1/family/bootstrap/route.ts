import { NextRequest } from 'next/server';
import { ApiError, authenticatedContext, failure, reply } from '../../../../../server/api';
export async function POST(request: NextRequest) {
  try {
    const { db, user } = await authenticatedContext(request);
    const { data, error } = await db.rpc('bootstrap_parent_family', { p_user_id: user.id });
    if (error || !data?.familyId) throw new ApiError(503, 'Family setup unavailable');
    return reply({ familyId: data.familyId });
  } catch (error) { return failure(error); }
}
