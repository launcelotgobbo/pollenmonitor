import { numericSpeciesEntriesSql, query, TS_ISO } from '@/lib/db';
import type { DailyPollenRow, HourlyPollenRow } from '@/lib/pollen-types';
import { withNabRisk } from '@/lib/risk';
import { normalizeSpecies } from '@/lib/species';

export type DailyPollenDbRow = {
  date: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  timezone: string | null;
  species: unknown;
};

export function utcDayWindow(date: string): { dayStart: string; dayEnd: string } {
  const dayStart = new Date(`${date}T00:00:00Z`).toISOString();
  const nextDay = new Date(`${date}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return { dayStart, dayEnd: nextDay.toISOString() };
}

export async function getHourlyPollenRows(
  city: string,
  date: string,
): Promise<HourlyPollenRow[]> {
  const { dayStart, dayEnd } = utcDayWindow(date);
  const { rows } = await query<{
    ts: string;
    tree: number | null;
    grass: number | null;
    weed: number | null;
    timezone: string | null;
    species: unknown;
  }>(
    `SELECT ${TS_ISO} AS ts, grass, tree, weed, tz AS timezone, species
     FROM pollen_readings_hourly
     WHERE city_slug = $1 AND ts >= $2 AND ts < $3
     ORDER BY ts ASC`,
    [city, dayStart, dayEnd],
  );

  return rows.map((row) =>
    withNabRisk({
      ts: row.ts,
      tree: row.tree ?? null,
      grass: row.grass ?? null,
      weed: row.weed ?? null,
      total: (row.grass ?? 0) + (row.tree ?? 0) + (row.weed ?? 0),
      species: row.species ?? null,
      timezone: row.timezone ?? null,
    }),
  );
}

export async function getDailyPollenRows(city: string): Promise<DailyPollenRow[]> {
  const { rows } = await query<DailyPollenDbRow>(
    `WITH recent_days AS MATERIALIZED (
       SELECT (ts AT TIME ZONE 'UTC')::date AS day
       FROM pollen_readings_hourly
       WHERE city_slug = $1
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 720
     ),
     filtered AS MATERIALIZED (
       SELECT reading.ts, reading.tree, reading.grass, reading.weed, reading.tz, reading.species,
              (reading.ts AT TIME ZONE 'UTC')::date AS day
       FROM pollen_readings_hourly AS reading
       WHERE reading.city_slug = $1
         AND reading.ts >= (
           SELECT min(day)::timestamp AT TIME ZONE 'UTC'
           FROM recent_days
         )
     ),
     daily AS (
       SELECT day::text AS date,
            round(avg(tree))::int AS tree,
            round(avg(grass))::int AS grass,
            round(avg(weed))::int AS weed,
            round(avg(CASE
              WHEN tree IS NULL AND grass IS NULL AND weed IS NULL THEN NULL
              ELSE coalesce(tree, 0) + coalesce(grass, 0) + coalesce(weed, 0)
            END))::int AS total,
            max(tz) AS timezone
       FROM filtered
       GROUP BY 1
     ),
     species_values AS (
       SELECT filtered.day::text AS date,
              category.key AS category,
              item.key AS species_name,
              round(avg(item.value::numeric))::int AS value
       FROM filtered
       CROSS JOIN LATERAL ${numericSpeciesEntriesSql('filtered.species')}
       GROUP BY 1, 2, 3
     ),
     species_categories AS (
       SELECT date, category, jsonb_object_agg(species_name, value) AS values
       FROM species_values
       GROUP BY 1, 2
     ),
     daily_species AS (
       SELECT date, jsonb_object_agg(category, values) AS species
       FROM species_categories
       GROUP BY 1
     )
     SELECT daily.*, daily_species.species
     FROM daily
     LEFT JOIN daily_species USING (date)
     ORDER BY date DESC`,
    [city],
  );

  return toDailyPollenRows(rows);
}

export function toDailyPollenRows(rows: DailyPollenDbRow[]): DailyPollenRow[] {
  return rows.map((row) => {
    const species = normalizeSpecies(row.species);
    const classified = withNabRisk({
      tree: row.tree,
      grass: row.grass,
      weed: row.weed,
      species,
    });
    return {
      date: row.date,
      tree: row.tree,
      grass: row.grass,
      weed: row.weed,
      total: row.total,
      timezone: row.timezone,
      species,
      risk_tree: classified.risk_tree,
      risk_grass: classified.risk_grass,
      risk_weed: classified.risk_weed,
    };
  });
}
