import { NextRequest } from 'next/server';
import { getLatestDate } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const date = await getLatestDate();
    return Response.json({ date });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

