import { numericSpeciesEntriesSql, query } from '@/lib/db';
import { parseUtcDate } from '@/lib/date';

export type RefreshPollenDailyOptions = {
  // Any timestamps inside the window; the refresh recomputes every UTC day
  // the window touches, from all hourly rows of those days.
  from: string | Date;
  to: string | Date;
  // Restrict to these city slugs; omit for every city.
  cities?: string[];
};

export type RefreshPollenDailySummary = {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, exclusive
  rows: number;
};

function toDate(value: string | Date): Date {
  const parsed = value instanceof Date ? value : parseUtcDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp for daily refresh: ${String(value)}`);
  }
  return parsed;
}

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Whole UTC days covering [from, to]: start of from's day to start of the day after to's. */
export function utcDayBounds(from: string | Date, to: string | Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = utcDayStart(toDate(from));
  const dayEnd = utcDayStart(toDate(to));
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  if (dayEnd <= dayStart) {
    throw new Error('Daily refresh window must end after it starts');
  }
  return { dayStart, dayEnd };
}

// Aggregation rules match what the daily readers computed on the fly before
// this table existed: category and species averages are rounded means over
// the hours present, peaks are maxima, and total is the per-hour category sum
// (null when an hour has no category at all) before averaging.
const TOTAL_SQL = `CASE
  WHEN tree IS NULL AND grass IS NULL AND weed IS NULL THEN NULL
  ELSE coalesce(tree, 0) + coalesce(grass, 0) + coalesce(weed, 0)
END`;

export const REFRESH_POLLEN_DAILY_SQL = `
  WITH filtered AS MATERIALIZED (
    SELECT city_slug, tree, grass, weed, tz, species,
           (ts AT TIME ZONE 'UTC')::date AS day
    FROM pollen_readings_hourly
    WHERE ts >= $1 AND ts < $2
      AND ($3::text[] IS NULL OR city_slug = ANY($3::text[]))
  ),
  daily AS (
    SELECT city_slug, day,
           count(*)::int AS readings,
           round(avg(tree))::int AS tree,
           round(avg(grass))::int AS grass,
           round(avg(weed))::int AS weed,
           round(avg(${TOTAL_SQL}))::int AS total,
           max(tree)::int AS peak_tree,
           max(grass)::int AS peak_grass,
           max(weed)::int AS peak_weed,
           max(${TOTAL_SQL})::int AS peak_total,
           max(tz) AS tz
    FROM filtered
    GROUP BY 1, 2
  ),
  species_values AS (
    SELECT filtered.city_slug, filtered.day,
           category.key AS category,
           item.key AS species_name,
           round(avg(item.value::numeric))::int AS value,
           max(item.value::numeric)::int AS peak_value
    FROM filtered
    CROSS JOIN LATERAL ${numericSpeciesEntriesSql('filtered.species')}
    GROUP BY 1, 2, 3, 4
  ),
  species_categories AS (
    SELECT city_slug, day, category,
           jsonb_object_agg(species_name, value) AS values,
           jsonb_object_agg(species_name, peak_value) AS peak_values
    FROM species_values
    GROUP BY 1, 2, 3
  ),
  daily_species AS (
    SELECT city_slug, day,
           jsonb_object_agg(category, values) AS species,
           jsonb_object_agg(category, peak_values) AS peak_species
    FROM species_categories
    GROUP BY 1, 2
  )
  INSERT INTO pollen_daily (
    city_slug, date, tz, readings, tree, grass, weed, total,
    peak_tree, peak_grass, peak_weed, peak_total, species, peak_species, updated_at
  )
  SELECT daily.city_slug, daily.day, daily.tz, daily.readings,
         daily.tree, daily.grass, daily.weed, daily.total,
         daily.peak_tree, daily.peak_grass, daily.peak_weed, daily.peak_total,
         daily_species.species, daily_species.peak_species, now()
  FROM daily
  LEFT JOIN daily_species USING (city_slug, day)
  ON CONFLICT (city_slug, date) DO UPDATE SET
    tz = EXCLUDED.tz,
    readings = EXCLUDED.readings,
    tree = EXCLUDED.tree,
    grass = EXCLUDED.grass,
    weed = EXCLUDED.weed,
    total = EXCLUDED.total,
    peak_tree = EXCLUDED.peak_tree,
    peak_grass = EXCLUDED.peak_grass,
    peak_weed = EXCLUDED.peak_weed,
    peak_total = EXCLUDED.peak_total,
    species = EXCLUDED.species,
    peak_species = EXCLUDED.peak_species,
    updated_at = now()
`;

/**
 * Recompute pollen_daily for every UTC day the window touches. Idempotent:
 * re-running over the same days rewrites the same values.
 */
export async function refreshPollenDaily({
  from,
  to,
  cities,
}: RefreshPollenDailyOptions): Promise<RefreshPollenDailySummary> {
  const { dayStart, dayEnd } = utcDayBounds(from, to);
  const result = await query(REFRESH_POLLEN_DAILY_SQL, [
    dayStart.toISOString(),
    dayEnd.toISOString(),
    cities && cities.length > 0 ? cities : null,
  ]);
  return {
    from: dayStart.toISOString().slice(0, 10),
    to: dayEnd.toISOString().slice(0, 10),
    rows: result.rowCount ?? 0,
  };
}
