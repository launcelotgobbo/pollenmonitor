import { NextRequest } from 'next/server';
import { googleLookup } from '@/lib/ingest/google';
import { upsertPollenPlants, upsertPollenReading, logIngest } from '@/lib/db';

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
  const date = new Date().toISOString().slice(0, 10);
  const daysParam = 5;
  const cities = await loadCities();
  let wrote = 0;
  let failed = 0;
  let totalDaysStored = 0;

  for (const city of cities) {
    try {
      const days = await googleLookup(city.lat, city.lon, date);
      const slice = days.slice(0, daysParam);
      for (const d of slice) {
        const total = [d.grassIndex, d.treeIndex, d.weedIndex]
          .filter((v) => typeof v === 'number')
          .reduce((a, b) => a + (b as number), 0);
        await upsertPollenReading({
          city_slug: city.slug,
          city_name: city.name,
          lat: city.lat,
          lon: city.lon,
          date: d.date,
          source: 'google',
          grass: (d.grassIndex ?? null) as any,
          tree: (d.treeIndex ?? null) as any,
          weed: (d.weedIndex ?? null) as any,
          total: total || null,
          is_forecast: true,
        });
        const plants = (d.plants || []).filter((p) => p.index != null);
        if (plants.length) {
          await upsertPollenPlants(
            { slug: city.slug, name: city.name, lat: city.lat, lon: city.lon },
            d.date,
            plants,
            true,
          );
        }
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
    date,
    days: daysParam,
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
