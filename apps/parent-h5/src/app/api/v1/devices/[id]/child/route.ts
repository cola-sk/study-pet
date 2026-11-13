import { NextRequest } from 'next/server';
import { ApiError, failure, parentContext, reply } from '../../../../../../server/api';
import { deviceVersion, managementFailure } from '../../../../../../server/management';
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const body = await request.json().catch(() => null);
    if (!uuid.test(params.id) || typeof body?.childId !== 'string' || !uuid.test(body.childId)) throw new ApiError(400, 'Invalid device or child');
    const { db, familyId } = await parentContext(request);
    const { data, error } = body.expectedVersion === undefined
      ? await db.rpc('assign_device_child', { p_family_id: familyId, p_device_id: params.id, p_child_id: body.childId })
      : await db.rpc('manage_family_device', { p_family_id: familyId, p_device_id: params.id, p_child_id: body.childId, p_action: 'assign', p_expected_version: deviceVersion(body.expectedVersion) });
    managementFailure(error);
    if (!data?.success) throw new ApiError(404, 'Device or child not found');
    return reply({ assigned: true });
  } catch (error) { return failure(error); }
}
