import { withNabRisk, type PollenRisk } from '@/lib/risk';

export type PollenRangeAggregate = 'none' | 'day';

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

/** Marks a caller-fixable input problem, so only these messages reach clients. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function parseDate(value: string | null, label: string): Date {
  if (!value) throw new ValidationError(`Missing required parameter '${label}'`);
  const normalized = value.trim();
  const isoLike = /\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?/;
  const candidate = isoLike.test(normalized) ? normalized : `${normalized}T00:00:00Z`;
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid date value provided for '${label}'`);
  }
  return date;
}

export function parseAggregate(value: string | null): PollenRangeAggregate {
  if (!value || value === 'none') return 'none';
  if (value === 'day') return 'day';
  throw new ValidationError("Invalid parameter 'aggregate': expected 'none' or 'day'");
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
