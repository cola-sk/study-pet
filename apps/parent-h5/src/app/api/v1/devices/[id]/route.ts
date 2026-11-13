import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../server/api';
import { deviceVersion, managementFailure, profileName, uuidPattern } from '../../../../../server/management';

async function manage(request: NextRequest, id: string, action: 'rename' | 'unlink') {
  try {
    if (!uuidPattern.test(id)) throw new ApiError(400, '无效的设备编号');
    const { db, familyId } = await parentContext(request);
    const body = await request.json().catch(() => null);
    const version = deviceVersion(body?.expectedVersion);
    const alias = action === 'rename' ? profileName(body?.alias, '设备名称') : null;
    const { error } = await db.rpc('manage_family_device', {
      p_family_id: familyId, p_device_id: id, p_action: action, p_expected_version: version, p_alias: alias,
    });
    managementFailure(error);
    return reply({ success: true });
  } catch (error) { return failure(error); }
}
export function PATCH(request: NextRequest, { params }: { params: { id: string } }) { return manage(request, params.id, 'rename'); }
export function DELETE(request: NextRequest, { params }: { params: { id: string } }) { return manage(request, params.id, 'unlink'); }
