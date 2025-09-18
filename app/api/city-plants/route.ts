import { NextRequest } from 'next/server';
import { getCityTypeSeries } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const days = Number(searchParams.get('days') || '90');
  if (!city) return new Response(JSON.stringify({ error: 'city required' }), { status: 400 });
  try {
    const rows = await getCityTypeSeries(city, days);
    return Response.json({ city, rows });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

