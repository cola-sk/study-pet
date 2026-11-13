import { NextRequest } from 'next/server';
import { ApiError, deviceContext, failure, reply } from '../../../../../../server/api';
import { uuid } from '../../../../../../server/shop';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const { db, device } = await deviceContext(request);
    const body = await request.json().catch(() => null);
    if (typeof body?.itemId !== 'string' || !uuid.test(body.itemId) || typeof body.requestId !== 'string' || !uuid.test(body.requestId) || !Number.isInteger(body.expectedPrice) || body.expectedPrice < 1 || body.expectedPrice > 10000 || typeof body.expectedVersion !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(body.expectedVersion) || !Number.isFinite(Date.parse(body.expectedVersion))) throw new ApiError(400, 'Invalid purchase');
    if (body.expectedBindingVersion != null && (typeof body.expectedBindingVersion !== 'string' || !uuid.test(body.expectedBindingVersion))) throw new ApiError(400, 'Invalid device binding');
    const { data, error } = await db.rpc('purchase_family_shop_item_scoped', { p_device_id: device.id, p_item_id: body.itemId, p_request_id: body.requestId, p_expected_price: body.expectedPrice, p_expected_version: body.expectedVersion, p_expected_binding: body.expectedBindingVersion ?? null });
    if (error) {
      if (error.code === 'P0001') return reply({ error: 'Not enough credits', code: 'insufficient_credits' }, 409);
      if (error.code === '40001') return reply({ error: 'Item changed; refresh shop', code: 'item_changed' }, 409);
      if (error.code === 'P0002') return reply({ error: 'Item unavailable', code: 'item_unavailable' }, 404);
      if (error.code === '23505') return reply({ error: 'Purchase request conflict', code: 'request_conflict' }, 409);
      if (error.code === '42501') throw new ApiError(403, 'Device unavailable');
      throw new ApiError(503, 'Purchase unavailable');
    }
    return reply(data);
  } catch (error) { return failure(error); }
}
