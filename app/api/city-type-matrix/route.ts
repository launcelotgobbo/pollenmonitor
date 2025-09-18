import { NextRequest } from 'next/server';
import { getCityTypeMatrix } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const days = Number(searchParams.get('days') || '60');
  if (!city) return new Response(JSON.stringify({ error: 'city required' }), { status: 400 });
  try {
    const rows = await getCityTypeMatrix(city, days);
    return Response.json({ city, rows });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

