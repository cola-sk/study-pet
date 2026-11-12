import { NextResponse } from 'next/server';

// Public connectivity probe only: never return configuration, identifiers or credentials.
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json({ ok: true, service: 'study-pet', api: 'device-health-v1' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
