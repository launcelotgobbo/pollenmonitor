import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(_req: NextRequest) {
  try {
    const rows = await supabaseGet<Array<{ date: string }>>(
      'pollen_readings',
      'select=date&order=date.desc&limit=365',
    );
    const seen = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);
    const dates = rows
      .map((r) => r.date)
      .filter((d) => typeof d === 'string')
      .filter((d) => d <= today)
      .filter((d) => (seen.has(d) ? false : (seen.add(d), true)));
    return Response.json({ dates });
  } catch (e: any) {
    console.error('[available-dates] error:', e);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check SUPABASE_URL/ANON_KEY.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
