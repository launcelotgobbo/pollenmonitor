import { NextRequest } from 'next/server';
import { getPollenByCity, getPollenByDate } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const city = searchParams.get('city');

  try {
    if (date) {
      const rows = await getPollenByDate(date);
      return Response.json({ date, rows });
    }
    if (city) {
      const rows = await getPollenByCity(city);
      return Response.json({ city, rows });
    }
    return new Response(
      JSON.stringify({ error: 'Provide either ?date=YYYY-MM-DD or ?city=slug' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Failed to fetch pollen data' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export const dynamic = 'force-dynamic'; // ensure API bypasses static cache

