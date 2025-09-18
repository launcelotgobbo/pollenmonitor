import { NextRequest } from 'next/server';
import { getAvailableDates } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const dates = await getAvailableDates(365);
    return Response.json({ dates });
  } catch (e: any) {
    console.error('[available-dates] error:', e);
    return new Response(JSON.stringify({ error: 'DB unavailable. Check POSTGRES_URL and network.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
