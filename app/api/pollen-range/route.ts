import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';
import {
  AggregatedCityDays,
  HourlyRow,
  aggregateDaily,
  normalizeCityList,
  parseDate,
} from '@/lib/pollenRange';

function toIsoString(date: Date): string {
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  try {
    const fromDate = parseDate(searchParams.get('from'), 'from');
    const toDate = parseDate(searchParams.get('to'), 'to');
    if (fromDate >= toDate) {
      return new Response(JSON.stringify({ error: "Parameter 'from' must be before 'to'" }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const fromIso = toIsoString(fromDate);
    const toIso = toIsoString(toDate);
    const cityList = normalizeCityList(searchParams.get('city'));
    const aggregate = searchParams.get('aggregate') === 'day' ? 'day' : 'none';
    const limitParam = Number(searchParams.get('limit') || '20000');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50000) : 20000;

    const params = new URLSearchParams();
    params.set('select', 'city_slug,ts,tree,grass,weed,risk_tree,risk_grass,risk_weed,tz');
    params.set('order', 'ts.asc');
    params.set('ts', `gte.${fromIso}`);
    params.append('ts', `lt.${toIso}`);
    params.set('limit', limit.toString());

    if (cityList.length === 1) {
      params.set('city_slug', `eq.${cityList[0]}`);
    } else if (cityList.length > 1) {
      const inList = cityList.map((slug) => `"${slug}"`).join(',');
      params.set('city_slug', `in.(${inList})`);
    }

    const rows = await supabaseGet<HourlyRow[]>('pollen_readings_hourly', params.toString());

    if (aggregate === 'day') {
      const aggregated: AggregatedCityDays[] = aggregateDaily(rows);
      return Response.json({
        from: fromIso,
        to: toIso,
        cities: cityList,
        aggregate: 'day',
        rows: aggregated,
      });
    }

    const mapped = rows.map((row) => ({
      ...row,
      total:
        (typeof row.tree === 'number' ? row.tree : 0) +
        (typeof row.grass === 'number' ? row.grass : 0) +
        (typeof row.weed === 'number' ? row.weed : 0),
      timezone: row.tz ?? null,
    }));

    return Response.json({
      from: fromIso,
      to: toIso,
      cities: cityList,
      aggregate: 'none',
      rows: mapped,
    });
  } catch (error: any) {
    console.error('[pollen-range] error', error);
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
