import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(_req: NextRequest) {
  try {
    const rows = await supabaseGet<Array<{ ts: string }>>(
      'pollen_readings_hourly',
      'select=ts&order=ts.desc&limit=1',
    );
    const latest = rows?.[0]?.ts?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    return Response.json({ date: latest });
  } catch (e: any) {
    console.error('[latest-date] error:', e);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
