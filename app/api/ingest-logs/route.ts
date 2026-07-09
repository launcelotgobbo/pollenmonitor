import { NextRequest } from 'next/server';
import { query, TS_ISO } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || '20')));

  try {
    const { rows } = await query<{ ts: string; status: string; details: any }>(
      `SELECT ${TS_ISO} AS ts, status, details
       FROM ingest_logs
       ORDER BY ingest_logs.ts DESC
       LIMIT $1`,
      [limit],
    );
    return Response.json({ logs: rows });
  } catch (e: any) {
    console.error('[ingest-logs] error', e);
    return new Response(JSON.stringify({ error: 'Database unavailable. Check POSTGRES_URL.' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
