import { NextRequest } from 'next/server';
import { googleLookup } from '@/lib/ingest/google';

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function loadCities() {
  try {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile('public/data/us-top-40-cities.geojson', 'utf-8');
    return JSON.parse(buf);
  } catch {
    return { features: [] };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const citySlug = searchParams.get('city') || undefined;
  const date = searchParams.get('date') || undefined;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  let latNum: number | undefined;
  let lonNum: number | undefined;

  if (lat && lon) {
    latNum = Number(lat);
    lonNum = Number(lon);
  } else if (citySlug) {
    const fc = await loadCities();
    const f = fc.features.find((x: any) => slugify(x.properties.name) === citySlug);
    if (!f) return new Response(JSON.stringify({ error: 'city not found' }), { status: 404 });
    lonNum = f.geometry.coordinates[0];
    latNum = f.geometry.coordinates[1];
  } else {
    return new Response(JSON.stringify({ error: 'provide ?city=slug or ?lat&lon' }), { status: 400 });
  }

  try {
    const days = await googleLookup(latNum!, lonNum!);
    const selected = date ? days.find((d) => d.date === date) || days[0] : days[0];
    return Response.json({ lat: latNum, lon: lonNum, date: selected.date, summary: {
      grass_index: selected.grassIndex ?? null,
      tree_index: selected.treeIndex ?? null,
      weed_index: selected.weedIndex ?? null,
    }, plants: selected.plants || [] });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'lookup failed' }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

