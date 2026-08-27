import type { PollenHourlyRow } from '@/lib/db';
import type { AmbeeHourly } from '@/lib/ingest/ambee';

export function toStoredPollenRow(
  citySlug: string,
  hour: AmbeeHourly,
): PollenHourlyRow {
  return {
    city_slug: citySlug,
    ts: hour.ts,
    tz: hour.tz ?? null,
    grass: hour.grass ?? null,
    tree: hour.tree ?? null,
    weed: hour.weed ?? null,
    total: (hour.grass ?? 0) + (hour.tree ?? 0) + (hour.weed ?? 0),
    risk_grass: hour.risk_grass ?? null,
    risk_tree: hour.risk_tree ?? null,
    risk_weed: hour.risk_weed ?? null,
    species: hour.species ?? null,
  };
}
