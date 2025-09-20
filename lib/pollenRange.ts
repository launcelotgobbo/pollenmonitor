export type HourlyRow = {
  city_slug: string;
  ts: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  risk_tree: string | null;
  risk_grass: string | null;
  risk_weed: string | null;
  tz: string | null;
};

export type AggregatedDay = {
  date: string;
  avg_tree: number | null;
  avg_grass: number | null;
  avg_weed: number | null;
  avg_total: number | null;
  timezone: string | null;
};

export type AggregatedCityDays = { city: string; data: AggregatedDay[] };

type InternalDay = AggregatedDay & {
  treeSum: number;
  treeCount: number;
  grassSum: number;
  grassCount: number;
  weedSum: number;
  weedCount: number;
  totalSum: number;
  totalCount: number;
};

export function normalizeCityList(cityParam: string | null): string[] {
  if (!cityParam) return [];
  return cityParam
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());
}

export function parseDate(value: string | null, label: string): Date {
  if (!value) throw new Error(`Missing required parameter '${label}'`);
  const normalized = value.trim();
  const isoLike = /\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?/;
  const candidate = isoLike.test(normalized) ? normalized : `${normalized}T00:00:00Z`;
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value provided for '${label}'`);
  }
  return date;
}

export function aggregateDaily(rows: HourlyRow[]): AggregatedCityDays[] {
  const byCity = new Map<string, Map<string, InternalDay>>();

  const bump = (city: string, day: string, row: HourlyRow) => {
    const cityMap = byCity.get(city) ?? new Map<string, InternalDay>();
    byCity.set(city, cityMap);
    const existing = cityMap.get(day) ?? {
      date: day,
      avg_tree: null,
      avg_grass: null,
      avg_weed: null,
      avg_total: null,
      timezone: row.tz ?? null,
      treeSum: 0,
      treeCount: 0,
      grassSum: 0,
      grassCount: 0,
      weedSum: 0,
      weedCount: 0,
      totalSum: 0,
      totalCount: 0,
    };

    if (typeof row.tree === 'number') {
      existing.treeSum += row.tree;
      existing.treeCount += 1;
    }
    if (typeof row.grass === 'number') {
      existing.grassSum += row.grass;
      existing.grassCount += 1;
    }
    if (typeof row.weed === 'number') {
      existing.weedSum += row.weed;
      existing.weedCount += 1;
    }

    const hasAnyValue =
      typeof row.tree === 'number' || typeof row.grass === 'number' || typeof row.weed === 'number';
    const total =
      (typeof row.tree === 'number' ? row.tree : 0) +
      (typeof row.grass === 'number' ? row.grass : 0) +
      (typeof row.weed === 'number' ? row.weed : 0);
    if (hasAnyValue) {
      existing.totalSum += total;
      existing.totalCount += 1;
    }

    if (!existing.timezone && row.tz) {
      existing.timezone = row.tz;
    }

    cityMap.set(day, existing);
  };

  for (const row of rows) {
    const city = row.city_slug;
    const ts = row.ts;
    if (!city || !ts) continue;
    const day = ts.slice(0, 10);
    if (!day) continue;
    bump(city, day, row);
  }

  const result: AggregatedCityDays[] = [];
  for (const [city, dayMap] of byCity.entries()) {
    const data = Array.from(dayMap.values())
      .map((entry) => ({
        date: entry.date,
        avg_tree: entry.treeCount > 0 ? Math.round(entry.treeSum / entry.treeCount) : null,
        avg_grass: entry.grassCount > 0 ? Math.round(entry.grassSum / entry.grassCount) : null,
        avg_weed: entry.weedCount > 0 ? Math.round(entry.weedSum / entry.weedCount) : null,
        avg_total: entry.totalCount > 0 ? Math.round(entry.totalSum / entry.totalCount) : null,
        timezone: entry.timezone,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    result.push({ city, data });
  }

  return result.sort((a, b) => a.city.localeCompare(b.city, 'en', { sensitivity: 'base' }));
}
