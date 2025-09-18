import { ambeeCurrent, ambeeHistorical } from './ambee';
import { googleForecast } from './google';
import { CityTarget, ProviderReading } from './types';
import { ensureSchema, upsertPollenReading, logIngest } from '@/lib/db';

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function loadCityTargets(): Promise<CityTarget[]> {
  // Try local file first to avoid relying on HTTP within serverless
  try {
    const mod = await import('node:fs/promises');
    const path = 'public/data/us-top-40-cities.geojson';
    const buf = await mod.readFile(path, 'utf-8');
    const fc = JSON.parse(buf);
    return fc.features.map((f: any) => ({
      name: f.properties.name,
      slug: slugify(f.properties.name),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }));
  } catch {}

  // Fallback to HTTP if file read fails
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/data/us-top-40-cities.geojson`, { cache: 'no-store' });
    const fc = await res.json();
    return fc.features.map((f: any) => ({
      name: f.properties.name,
      slug: slugify(f.properties.name),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }));
  } catch {
    return [];
  }
}

export async function runIngest(options: { date?: string; includeForecast?: boolean } = {}) {
  const start = Date.now();
  const date = options.date || new Date().toISOString().slice(0, 10);
  const includeForecast = options.includeForecast ?? true;
  await ensureSchema();
  const cities = await loadCityTargets();

  let ok = 0;
  let fail = 0;

  for (const city of cities) {
    try {
      // Ambee actuals (historical or current)
      const ambee = await ambeeHistorical(city.lat, city.lon, date);
      if (ambee) {
        await upsertPollenReading({
          city_slug: city.slug,
          city_name: city.name,
          lat: city.lat,
          lon: city.lon,
          date: ambee.date,
          source: 'ambee',
          grass: ambee.grass ?? null,
          tree: ambee.tree ?? null,
          weed: ambee.weed ?? null,
          total: ambee.total ?? null,
        });
      }

      // Google forecast (optional)
      if (includeForecast) {
        const g = await googleForecast(city.lat, city.lon, date);
        if (g) {
          await upsertPollenReading({
            city_slug: city.slug,
            city_name: city.name,
            lat: city.lat,
            lon: city.lon,
            date: g.date,
            source: 'google',
            grass: g.grass ?? null,
            tree: g.tree ?? null,
            weed: g.weed ?? null,
            total: g.total ?? null,
          });
        }
      }

      ok++;
    } catch (e) {
      console.error('Ingest error for', city.slug, e);
      fail++;
    }
  }

  const details = { date, cities: cities.length, ok, fail, ms: Date.now() - start };
  await logIngest(fail === 0 ? 'success' : 'partial', details);
  return details;
}
