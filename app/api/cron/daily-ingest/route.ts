import { NextRequest } from 'next/server';
import { ambeeHourlyRange } from '@/lib/ingest/ambee';
import { upsertPollenHourly, logIngest } from '@/lib/db';

type City = { name: string; slug: string; lat: number; lon: number };

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function loadCities(): Promise<City[]> {
  try {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile('public/data/us-top-40-cities.geojson', 'utf-8');
    const fc = JSON.parse(buf);
    return fc.features.map((f: any) => ({
      name: f.properties.name as string,
      slug: slugify(f.properties.name as string),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const cronHeader =
    req.headers.get('x-vercel-cron') ||
    req.headers.get('x-vercel-schedule') ||
    req.headers.get('x-vercel-oidc-token') ||
    req.headers.get('x-vercel-proxy-signature');
  const urlToken = new URL(req.url).searchParams.get('token');
  const headerToken = req.headers.get('x-ingest-token');
  const validToken = process.env.INGEST_TOKEN;
  const envTokenPresent = Boolean(validToken && validToken.length > 0);
  const urlTokenProvided = Boolean(urlToken && urlToken.length > 0);
  const headerTokenProvided = Boolean(headerToken && headerToken.length > 0);
  const tokenMatch = Boolean(validToken && (urlToken === validToken || headerToken === validToken));
  const authorized = Boolean(cronHeader || tokenMatch);

  if (!authorized) {
    const vercelHeaders: Record<string, string> = {};
    for (const [k, v] of req.headers.entries()) {
      if (k.startsWith('x-vercel')) vercelHeaders[k] = v;
    }
    console.warn('[cron daily-ingest] unauthorized request', {
      ts: new Date().toISOString(),
      isCron: Boolean(cronHeader),
      envTokenPresent,
      urlTokenProvided,
      headerTokenProvided,
      tokenMatch,
      path: '/api/cron/daily-ingest',
      vercelHeaders,
    });
    return new Response(
      JSON.stringify({ error: 'Unauthorized', isCron: Boolean(cronHeader), tokenProvided: urlTokenProvided || headerTokenProvided }),
      { status: 401 },
    );
  }

  const start = Date.now();
  const now = new Date();
  const toISO = now.toISOString().slice(0, 19).replace('T', ' ');
  const fromDate = new Date(now);
  fromDate.setHours(fromDate.getHours() - 42);
  const fromISO = fromDate.toISOString().slice(0, 19).replace('T', ' ');
  const cities = await loadCities();
  let wrote = 0;
  let failed = 0;
  let totalDaysStored = 0;

  for (const city of cities) {
    try {
      const hours = await ambeeHourlyRange(city.lat, city.lon, fromISO, toISO);
      for (const h of hours) {
        await upsertPollenHourly({
          city_slug: city.slug,
          ts: h.ts,
          tz: h.tz ?? null,
          grass: h.grass ?? null,
          tree: h.tree ?? null,
          weed: h.weed ?? null,
          total: (h.grass ?? 0) + (h.tree ?? 0) + (h.weed ?? 0),
          risk_grass: h.risk_grass ?? null,
          risk_tree: h.risk_tree ?? null,
          risk_weed: h.risk_weed ?? null,
          species: h.species ?? null,
        });
        totalDaysStored++;
      }
      wrote++;
    } catch (e) {
      console.error('[cron ingest] error', city.slug, e);
      failed++;
    }
  }

  const result = {
    ok: failed === 0,
    from: fromISO,
    to: toISO,
    cities: cities.length,
    wrote,
    failed,
    totalDaysStored,
    ms: Date.now() - start,
  };
  await logIngest(result.ok ? 'success' : 'partial', result);
  return Response.json(result);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
