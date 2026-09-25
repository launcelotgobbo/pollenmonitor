import { query, TS_ISO } from '@/lib/db';
import { utcDayWindow } from '@/lib/date';
import type { DailyPollenHistoryRow, DailyPollenRow, HourlyPollenRow } from '@/lib/pollen-types';
import { withNabRisk } from '@/lib/risk';
import { normalizeSpecies } from '@/lib/species';

export type DailyPollenDbRow = {
  date: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  peak_tree: number | null;
  peak_grass: number | null;
  peak_weed: number | null;
  peak_total: number | null;
  timezone: string | null;
  species: unknown;
  peak_species: unknown;
};

const DAILY_API_LIMIT = 720;

export async function getHourlyPollenRows(city: string, date: string): Promise<HourlyPollenRow[]> {
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

// Daily rows come from pollen_daily, which the ingest job refreshes for every
// day it writes (lib/pollen-daily.ts).
async function queryDailyPollenRows(city: string, limit: number): Promise<DailyPollenRow[]> {
  const { rows } = await query<DailyPollenDbRow>(
    `SELECT date::text AS date, tree, grass, weed, total,
            peak_tree, peak_grass, peak_weed, peak_total,
            tz AS timezone, species, peak_species
     FROM pollen_daily
     WHERE city_slug = $1
     ORDER BY date DESC
     LIMIT $2`,
    [city, limit],
  );

  return toDailyPollenRows(rows);
}

export function getDailyPollenRows(city: string): Promise<DailyPollenRow[]> {
  return queryDailyPollenRows(city, DAILY_API_LIMIT);
}

export async function getLatestDailyPollenRow(city: string): Promise<DailyPollenRow | null> {
  const [latest] = await queryDailyPollenRows(city, 1);
  return latest ?? null;
}

export async function getCompleteDailyPollenHistory(
  city: string,
): Promise<DailyPollenHistoryRow[]> {
  const { rows } = await query<DailyPollenHistoryRow>(
    `SELECT date::text AS date, tree, grass, weed, total,
            peak_tree, peak_grass, peak_weed, peak_total
     FROM pollen_daily
     WHERE city_slug = $1
     ORDER BY date DESC`,
    [city],
  );
  return rows;
}

export function toDailyPollenRows(rows: DailyPollenDbRow[]): DailyPollenRow[] {
  return rows.map((row) => {
    const species = normalizeSpecies(row.species);
    const peakClassified = withNabRisk({
      tree: row.peak_tree,
      grass: row.peak_grass,
      weed: row.peak_weed,
      species: normalizeSpecies(row.peak_species),
    });
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
      peak_tree: row.peak_tree,
      peak_grass: row.peak_grass,
      peak_weed: row.peak_weed,
      peak_total: row.peak_total,
      timezone: row.timezone,
      species,
      risk_tree: classified.risk_tree,
      risk_grass: classified.risk_grass,
      risk_weed: classified.risk_weed,
      peak_risk_tree: peakClassified.risk_tree,
      peak_risk_grass: peakClassified.risk_grass,
      peak_risk_weed: peakClassified.risk_weed,
    };
  });
}
