import path from 'node:path';

export type City = { name: string; slug: string; lat: number; lon: number };

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const localGeoJsonPath = path.join(process.cwd(), 'public', 'data', 'us-top-40-cities.geojson');

async function loadFromFilesystem(): Promise<City[] | null> {
  try {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(localGeoJsonPath, 'utf-8');
    const fc = JSON.parse(buf);
    return fc.features.map((f: any) => ({
      name: f.properties.name as string,
      slug: slugify(f.properties.name as string),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
  } catch (err) {
    console.error('[cities] failed to read local geojson', {
      level: 'error',
      path: localGeoJsonPath,
      message: (err as Error)?.message ?? String(err),
    });
    return null;
  }
}

async function loadFromHttp(): Promise<City[] | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    if (!base) return null;
    const res = await fetch(`${base}/data/us-top-40-cities.geojson`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const fc = await res.json();
    return fc.features.map((f: any) => ({
      name: f.properties.name as string,
      slug: slugify(f.properties.name as string),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
  } catch (err) {
    console.error('[cities] failed to load geojson via HTTP', {
      level: 'error',
      message: (err as Error)?.message ?? String(err),
    });
    return null;
  }
}

export async function loadTopCities(): Promise<City[]> {
  const local = await loadFromFilesystem();
  if (local && local.length > 0) return local;

  const remote = await loadFromHttp();
  if (remote && remote.length > 0) return remote;

  console.error('[cities] unable to resolve any city definitions', {
    level: 'error',
  });
  return [];
}
