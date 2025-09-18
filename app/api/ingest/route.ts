import { NextRequest } from 'next/server';
import { runIngest } from '@/lib/ingest/run';

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-ingest-token');
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || undefined;
  const includeForecast = searchParams.get('forecast') !== 'false';

  try {
    const result = await runIngest({ date, includeForecast });
    return Response.json({ ...result });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'ingest failed' }), {
      status: 500,
    });
  }
}

export const dynamic = 'force-dynamic';

