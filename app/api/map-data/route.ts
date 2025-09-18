import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return new Response(JSON.stringify({ error: 'date required' }), { status: 400 });

  try {
    const base = date;
    const d0 = new Date(base);
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    const d2 = new Date(d0); d2.setDate(d2.getDate() + 2);
    const dates = [base, toISO(d1), toISO(d2)];

    // Fetch readings for base + next two days
    const readRows = await supabaseGet<Array<any>>(
      'pollen_readings',
      `select=city_slug,date,lat,lon,grass,tree,weed,total,source,is_forecast&date=in.(${dates.join(',')})&order=date.asc`,
    );

    // Group by city
    const byCity: Record<string, any[]> = {};
    for (const r of readRows) {
      const k = r.city_slug;
      (byCity[k] ||= []).push(r);
    }

    const prefer = (rows: any[]) => {
      // prefer Ambee actuals, else first
      const ambee = rows.find((r) => r.source === 'ambee');
      return ambee || rows[0];
    };

    const features = Object.entries(byCity).map(([city, rows]) => {
      const forDate = (iso: string) => rows.filter((r) => r.date === iso);
      const baseRow = prefer(forDate(base));
      const p0 = prefer(forDate(base));
      const p1 = prefer(forDate(dates[1]));
      const p2 = prefer(forDate(dates[2]));
      const series = [p0, p1, p2]
        .filter(Boolean)
        .map((r) => ({ date: r.date, tree: r.tree ?? null, grass: r.grass ?? null, weed: r.weed ?? null, is_forecast: !!r.is_forecast }));

      return {
        type: 'Feature',
        properties: {
          city,
          count: baseRow?.total ?? ((baseRow?.grass ?? 0) + (baseRow?.tree ?? 0) + (baseRow?.weed ?? 0)),
          is_forecast: !!baseRow?.is_forecast,
          source: baseRow?.source ?? null,
          tree: baseRow?.tree ?? null,
          grass: baseRow?.grass ?? null,
          weed: baseRow?.weed ?? null,
          top_plants: null,
          series,
        },
        geometry: { type: 'Point', coordinates: [baseRow?.lon ?? 0, baseRow?.lat ?? 0] },
      };
    });

    return Response.json({ type: 'FeatureCollection', features });
  } catch (e: any) {
    console.error('[map-data] error', e);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check env vars.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
