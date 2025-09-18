import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const days = Number(searchParams.get('days') || '60');
  if (!city) return new Response(JSON.stringify({ error: 'city required' }), { status: 400 });
  try {
    // Get last N distinct dates
    const dateRows = await supabaseGet<Array<{ date: string }>>(
      'pollen_readings',
      `select=date&city_slug=eq.${city}&order=date.desc&limit=${days}`,
    );
    const seen = new Set<string>();
    const baseDates = dateRows.map(r => r.date).filter(d => typeof d === 'string' && !seen.has(d) && (seen.add(d), true));
    if (baseDates.length === 0) return Response.json({ city, rows: [] });
    // Build query for base +1 +2
    const allDates = new Set<string>();
    const toISO = (s: string, add: number) => { const d = new Date(s); d.setDate(d.getDate()+add); return d.toISOString().slice(0,10); };
    baseDates.forEach(d => { allDates.add(d); allDates.add(toISO(d,1)); allDates.add(toISO(d,2)); });
    const allList = Array.from(allDates);
    const readings = await supabaseGet<Array<any>>(
      'pollen_readings',
      `select=date,tree,grass,weed,source,is_forecast&city_slug=eq.${city}&date=in.(${allList.join(',')})`,
    );
    // Group by date and pick preferred rows
    const byDate: Record<string, any[]> = {};
    for (const r of readings) (byDate[r.date] ||= []).push(r);
    const pick = (arr?: any[]) => arr && (arr.find(r => r.source==='ambee' && !r.is_forecast) || arr.find(r => !r.is_forecast) || arr[0]);
    const rows = baseDates.map((d) => {
      const d0 = pick(byDate[d]);
      const d1 = pick(byDate[toISO(d,1)]);
      const d2 = pick(byDate[toISO(d,2)]);
      return {
        date: d,
        day0: { tree: d0?.tree ?? null, grass: d0?.grass ?? null, weed: d0?.weed ?? null },
        day1: { tree: d1?.tree ?? null, grass: d1?.grass ?? null, weed: d1?.weed ?? null },
        day2: { tree: d2?.tree ?? null, grass: d2?.grass ?? null, weed: d2?.weed ?? null },
      };
    });
    return Response.json({ city, rows });
  } catch (e: any) {
    console.error('[city-type-matrix] error', e);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check env vars.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
