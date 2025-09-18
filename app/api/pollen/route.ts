import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const city = searchParams.get('city');

  try {
    if (date) {
      const rows = await supabaseGet<Array<any>>(
        'pollen_readings',
        `select=city_slug,date,grass,tree,weed,total,source,is_forecast&date=eq.${date}`,
      );
      // Reduce to one row per city (prefer Ambee)
      const byCity: Record<string, any[]> = {};
      for (const r of rows) (byCity[r.city_slug] ||= []).push(r);
      const out = Object.entries(byCity).map(([city, arr]) => {
        const pref = arr.find((r) => r.source === 'ambee') || arr[0];
        const count = pref?.total ?? ((pref?.grass ?? 0) + (pref?.tree ?? 0) + (pref?.weed ?? 0));
        return { city, date, count, source: pref?.source ?? null, is_forecast: !!pref?.is_forecast };
      });
      return Response.json({ date, rows: out });
    }
    if (city) {
      const rows = await supabaseGet<Array<any>>(
        'pollen_readings',
        `select=city_slug,date,grass,tree,weed,total,source,is_forecast&city_slug=eq.${city}&order=date.desc&limit=365`,
      );
      // Reduce to one row per date (prefer Ambee)
      const byDate: Record<string, any[]> = {};
      for (const r of rows) (byDate[r.date] ||= []).push(r);
      const out = Object.entries(byDate)
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([d, arr]) => {
          const pref = arr.find((r) => r.source === 'ambee') || arr[0];
          const count = pref?.total ?? ((pref?.grass ?? 0) + (pref?.tree ?? 0) + (pref?.weed ?? 0));
          return { city, date: d, count, source: pref?.source ?? null, is_forecast: !!pref?.is_forecast };
        });
      return Response.json({ city, rows: out });
    }
    return new Response(
      JSON.stringify({ error: 'Provide either ?date=YYYY-MM-DD or ?city=slug' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[pollen] error', err);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check env vars.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export const dynamic = 'force-dynamic'; // ensure API bypasses static cache
