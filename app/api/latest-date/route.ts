import { NextRequest } from 'next/server';
import { getLatestDate } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const date = await getLatestDate();
    return Response.json({ date });
  } catch (e: any) {
    console.error('[latest-date] error:', e);
    return new Response(JSON.stringify({ error: 'DB unavailable. Check POSTGRES_URL and network.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
