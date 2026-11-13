import 'server-only';
import { createHmac } from 'node:crypto';
import { ApiError } from './api';
export function pairingKey(): Buffer {
  const secret = process.env.PAIRING_CODE_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new ApiError(503, 'Pairing service is not configured');
  return Buffer.from(secret, 'hex');
}
export function makeCode(key: Buffer, userId: string, nonce: number): string {
  const digest = createHmac('sha256', key).update(`study-pet-code-v2:${userId}:${nonce}`).digest();
  return String(digest.readUInt32BE(0) % 1000000).padStart(6, '0');
}
export function digestCode(key: Buffer, code: string): string {
  return createHmac('sha256', key).update(`study-pet-lookup-v2:${code}`).digest('hex');
}
export function digestSource(key: Buffer, source: string): string {
  return createHmac('sha256', key).update(`study-pet-source-v1:${source}`).digest('hex');
}
