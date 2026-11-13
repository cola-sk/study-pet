import { NextRequest } from 'next/server';
import { ApiError, deviceContext, failure, reply } from '../../../../../../server/api';
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) throw new ApiError(400, 'Invalid task ID');
    const body = await request.json().catch(() => null);
    if (!body || typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId)) throw new ApiError(400, 'Invalid requestId');
    const { db, device } = await deviceContext(request);
    const { data, error } = await db.rpc('device_submit_task', { p_device_id: device.id, p_task_id: params.id, p_request_id: body.requestId });
    if (error) throw new ApiError(503, 'Task submission unavailable');
    if (!data?.success) return reply({ error: 'Task cannot be submitted', code: data?.code || 'task_changed' }, 409);
    return reply(data);
  } catch (error) { return failure(error); }
}
