import { NextRequest } from 'next/server';
import { googleLookup, GooglePollenDay } from '@/lib/ingest/google';
import { ensureSchema, logIngest, upsertPollenPlants, upsertPollenReading } from '@/lib/db';

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

function pickDay(days: GooglePollenDay[], date?: string) {
  if (!date) return days[0];
  return days.find((d) => d.date === date) || days[0];
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-ingest-token');
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || undefined;
  const onlyCity = searchParams.get('city') || undefined;
  const dryRun = searchParams.get('dry') === 'true';

  await ensureSchema();

  const cities = (await loadCities()).filter((c) => (onlyCity ? c.slug === onlyCity : true));
  if (!cities.length) {
    return Response.json({ ok: false, error: 'no cities found' }, { status: 400 });
  }

  const start = Date.now();
  let wrote = 0;
  let failed = 0;

  for (const city of cities) {
    try {
      const days = await googleLookup(city.lat, city.lon, date);
      const day = pickDay(days, date);
      const total = [day.grassIndex, day.treeIndex, day.weedIndex]
        .filter((v) => typeof v === 'number')
        .reduce((a, b) => a + (b as number), 0);

      if (!dryRun) {
        await upsertPollenReading({
          city_slug: city.slug,
          city_name: city.name,
          lat: city.lat,
          lon: city.lon,
          date: day.date,
          source: 'google',
          grass: (day.grassIndex ?? null) as any,
          tree: (day.treeIndex ?? null) as any,
          weed: (day.weedIndex ?? null) as any,
          total: total || null,
        });
        // Persist plants with indices (optionally filter to inSeason or with non-null index)
        const plants = (day.plants || []).filter((p) => p.index != null);
        if (plants.length) {
          await upsertPollenPlants({ slug: city.slug, name: city.name, lat: city.lat, lon: city.lon }, day.date, plants);
        }
      }
      wrote++;
    } catch (e) {
      console.error('ingest-google error', city.slug, e);
      failed++;
    }
  }

  const result = { ok: failed === 0, date: date || 'today', cities: cities.length, wrote, failed, ms: Date.now() - start };
  await logIngest(result.ok ? 'success' : 'partial', result);
  return Response.json(result);
}

export const dynamic = 'force-dynamic';

