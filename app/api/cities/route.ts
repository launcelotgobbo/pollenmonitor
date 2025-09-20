import { NextRequest } from 'next/server';
const CITY_GEOJSON_FILENAME = process.env.CITY_GEOJSON_FILENAME || 'us-top-175-cities.geojson';

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET(_req: NextRequest) {
  try {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(`public/data/${CITY_GEOJSON_FILENAME}`, 'utf-8');
    const fc = JSON.parse(buf);
    const cities = fc.features
      .map((f: any) => ({
        name: f.properties.name as string,
        slug: slugify(f.properties.name as string),
      }))
      .sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
      );
    return Response.json({ cities });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'failed to load cities' }), {
      status: 500,
    });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
