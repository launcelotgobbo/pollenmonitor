import { NextRequest } from 'next/server';
import { getMapDataByDate } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return new Response(JSON.stringify({ error: 'date required' }), { status: 400 });

  try {
    const rows = await getMapDataByDate(date);
    const features = rows.map((r: any) => ({
      type: 'Feature',
      properties: {
        city: r.city,
        count: r.count,
        is_forecast: r.is_forecast,
        source: r.source,
        tree: r.tree,
        grass: r.grass,
        weed: r.weed,
        top_plants: r.top_plants || null,
        series: r.series || null,
      },
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
    }));
    return Response.json({ type: 'FeatureCollection', features });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
