import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { db, familyId } = await parentContext(request);
    const { data, error } = await db.from('children').select('id,nickname,coins_balance,avatar_url').eq('family_id', familyId).order('created_at');
    if (error) throw new ApiError(503, 'Children unavailable');
    const [pets, devices] = await Promise.all([
      db.from('pet_states').select('child_id,food_count,water_count').eq('family_id', familyId),
      db.from('devices').select('id,alias,child_id').eq('family_id', familyId),
    ]);
    if (pets.error || devices.error) throw new ApiError(503, 'Companions unavailable');
    return reply({ children: data.map(child => ({ ...child,
      pet: pets.data.find(pet => pet.child_id === child.id) || null,
      devices: devices.data.filter(device => device.child_id === child.id),
    })) });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (typeof body?.nickname !== 'string' || !body.nickname.trim() || body.nickname.trim().length > 50) throw new ApiError(400, 'Invalid nickname');
    const { db, familyId } = await parentContext(request);
    const { data, error } = await db.from('children').insert({ family_id: familyId, nickname: body.nickname.trim() }).select('id,nickname,coins_balance,avatar_url').single();
    if (error) throw new ApiError(503, 'Could not create child');
    return reply({ child: data }, 201);
  } catch (error) { return failure(error); }
}
