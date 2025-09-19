import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(_req: NextRequest) {
  try {
    // Collect distinct dates from hourly readings (last N rows)
    const rows = await supabaseGet<Array<{ ts: string }>>(
      'pollen_readings_hourly',
      'select=ts&order=ts.desc&limit=5000',
    );
    const seen = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);
    const dates = rows
      .map((r) => (r.ts || '').slice(0, 10))
      .filter((d) => d && d <= today)
      .filter((d) => (seen.has(d) ? false : (seen.add(d), true)));
    return Response.json({ dates });
  } catch (e: any) {
    console.error('[available-dates] error:', e);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
