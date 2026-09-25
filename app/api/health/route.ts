import { evaluateHealth } from '@/lib/health';

// Public so uptime monitors and Vercel alerts can poll it. The report only
// carries freshness ages and counts, never provider errors or connection details.
export async function GET() {
  const report = await evaluateHealth();
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
