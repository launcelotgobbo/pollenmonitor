import { NextRequest } from 'next/server';
import { supabaseGet } from '@/lib/supabaseRest';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || '20')));

  try {
    const rows = await supabaseGet<Array<{ ts: string; status: string; details: any }>>(
      'ingest_logs',
      `select=ts,status,details&order=ts.desc&limit=${limit}`,
    );
    return Response.json({ logs: rows });
  } catch (e: any) {
    console.error('[ingest-logs] error', e);
    return new Response(JSON.stringify({ error: 'Supabase unavailable. Check env vars.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

