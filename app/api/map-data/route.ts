import { NextRequest } from 'next/server';
import {
  ApiValidationError,
  parseCalendarDateParameter,
  validationErrorResponse,
} from '@/lib/api-validation';
import { dataErrorResponse } from '@/lib/api-errors';
import {
  publicDataResponse,
  PUBLIC_DATA_CACHE_CONTROL,
} from '@/lib/api-response';
import { numericSpeciesEntriesSql, query } from '@/lib/db';
import { loadTopCities } from '@/lib/ingest/cities';
import { buildMapFeatureCollection, type DailyCityRow } from '@/lib/mapData';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');

  try {
    let date =
      dateParam === 'latest' ? dateParam : parseCalendarDateParameter(dateParam);
    if (!date || date === 'latest') {
      // Resolve server-side so the map can render without first fetching the
      // date list; capped at today to ignore any future-dated rows.
      const { rows: latest } = await query<{ d: string | null }>(
        `SELECT least((max(ts) AT TIME ZONE 'UTC')::date, (now() AT TIME ZONE 'UTC')::date)::text AS d
         FROM pollen_readings_hourly`,
      );
      date = latest[0]?.d || new Date().toISOString().slice(0, 10);
    }

    const base = new Date(`${date}T00:00:00Z`);
    const dayStart = base.toISOString();
    const windowEnd = new Date(base);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 3);
    const dayEnd = windowEnd.toISOString();

    // Aggregate to one row per city/day in SQL; the previous version shipped
    // every hourly row (~3k rows, ~500KB) out of the DB per request.
    const { rows } = await query<DailyCityRow>(
      `SELECT city_slug,
              ((ts AT TIME ZONE 'UTC')::date)::text AS date,
              max(reading.tree) AS tree,
              max(reading.grass) AS grass,
              max(reading.weed) AS weed,
              max(species_max.tree) AS max_species_tree,
              max(species_max.grass) AS max_species_grass,
              max(species_max.weed) AS max_species_weed,
              max(species_max.ragweed) AS ragweed,
              min(reading.tz) AS tz
       FROM pollen_readings_hourly AS reading
       LEFT JOIN LATERAL (
         SELECT (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'tree'))::float8 AS tree,
                (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'grass'))::float8 AS grass,
                (max(item.value::numeric) FILTER (WHERE lower(category.key) = 'weed'))::float8 AS weed,
                (max(item.value::numeric) FILTER (
                  WHERE lower(category.key) = 'weed' AND lower(item.key) = 'ragweed'
                ))::float8 AS ragweed
         FROM ${numericSpeciesEntriesSql('reading.species')}
       ) AS species_max ON true
       WHERE reading.ts >= $1 AND reading.ts < $2
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      [dayStart, dayEnd],
    );

    const cities = await loadTopCities();
    const coords: Record<string, [number, number]> = {};
    for (const c of cities) coords[c.slug] = [c.lon, c.lat];

    const fc = buildMapFeatureCollection(rows, coords, date);

    // The 3-day window is immutable once fully in the past; today's window is
    // still being ingested, so keep its TTL short.
    const todayUTC = new Date().toISOString().slice(0, 10);
    const windowFullyHistorical = dayEnd.slice(0, 10) <= todayUTC;
    const cacheControl = windowFullyHistorical
      ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'
      : PUBLIC_DATA_CACHE_CONTROL;

    return publicDataResponse(
      { ...fc, date },
      {
        headers: {
          'cache-control': cacheControl,
          'content-type': 'application/geo+json',
        },
      },
    );
  } catch (e: unknown) {
    if (e instanceof ApiValidationError) {
      return validationErrorResponse(e);
    }
    return dataErrorResponse('map-data', e);
  }
}

export const dynamic = 'force-dynamic';
