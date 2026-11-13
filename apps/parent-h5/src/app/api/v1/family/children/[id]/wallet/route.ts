import { NextRequest } from 'next/server';
import { ApiError, parentContext, failure, reply } from '../../../../../../../server/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, familyId } = await parentContext(request);
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw new ApiError(400, 'Invalid child');
    const child = await db.from('children').select('id,coins_balance').eq('id', params.id).eq('family_id', familyId).maybeSingle();
    if (child.error) throw new ApiError(503, 'Wallet unavailable');
    if (!child.data) throw new ApiError(404, 'Child unavailable');
    const [transactions, items] = await Promise.all([
      db.from('wallet_transactions').select('id,amount,balance_after,type,description,created_at').eq('family_id', familyId).eq('child_id', params.id).order('created_at', { ascending: false }).order('id').limit(50),
      db.from('family_shop_items').select('id,name,price,action,builtin_key,updated_at').eq('family_id', familyId).eq('archived', false).order('builtin_key', { ascending: false, nullsFirst: false }).order('created_at').order('id'),
    ]);
    if (transactions.error || items.error) throw new ApiError(503, 'Wallet details unavailable');
    return reply({ credits: child.data.coins_balance, transactions: transactions.data, items: items.data });
  } catch (error) { return failure(error); }
}
