import { ApiValidationError, parseDateTimeParameter } from '@/lib/api-validation';
import { withNabRisk, type PollenRisk } from '@/lib/risk';

export const POLLEN_RANGE_AGGREGATES = ['none', 'day'] as const;
export type PollenRangeAggregate = (typeof POLLEN_RANGE_AGGREGATES)[number];

export type PollenRangeDbRow = {
  city_slug: string;
  period_start: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  timezone: string | null;
  species?: unknown;
};

export type PollenRangeRow = {
  city: string;
  periodStart: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  timezone: string | null;
  species: unknown;
  risk_tree: PollenRisk | null;
  risk_grass: PollenRisk | null;
  risk_weed: PollenRisk | null;
};

export function normalizeCityList(cityParam: string | null): string[] {
  if (!cityParam) return [];
  return cityParam
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());
}

export { ApiValidationError as ValidationError };

export function parseDate(value: string | null, label: string): Date {
  return parseDateTimeParameter(value, label);
}

export function parseAggregate(value: string | null): PollenRangeAggregate {
  if (!value) return 'none';
  if ((POLLEN_RANGE_AGGREGATES as readonly string[]).includes(value)) {
    return value as PollenRangeAggregate;
  }
  throw new ApiValidationError("Invalid parameter 'aggregate': expected 'none' or 'day'");
}

export function toPollenRangeRows(rows: PollenRangeDbRow[]): PollenRangeRow[] {
  return rows.map((row) => {
    const species = row.species ?? null;
    const classified = withNabRisk({
      tree: row.tree,
      grass: row.grass,
      weed: row.weed,
      species,
    });
    return {
      city: row.city_slug,
      periodStart: row.period_start,
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
