import { NextRequest } from 'next/server';
import { getAvailableDates } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const dates = await getAvailableDates(365);
    return Response.json({ dates });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

