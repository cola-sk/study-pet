import { NextRequest } from 'next/server';
import { ApiError, deviceContext, failure, reply } from '../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, device } = await deviceContext(request, true);
    if (!device.child_id || device.status === 'unassigned') return reply({ state: 'awaiting_child' }, 409);
    const { data, error } = await db.from('children').select('coins_balance').eq('id', device.child_id).eq('family_id', device.family_id).maybeSingle();
    if (error) throw new ApiError(503, 'Wallet unavailable');
    if (!data) throw new ApiError(403, 'Device child is unavailable');
    return reply({ credits: data.coins_balance });
  } catch (error) { return failure(error); }
}
