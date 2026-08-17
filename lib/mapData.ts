import { pickHigherRisk, riskScore } from '@/lib/risk';

// One SQL-aggregated row per (city, UTC day): daily maxima plus the distinct
// risk labels observed that day (reduced to the highest one here so the label
// text from the provider is preserved).
export type DailyCityRow = {
  city_slug: string;
  date: string; // YYYY-MM-DD (UTC)
  tree: number | null;
  grass: number | null;
  weed: number | null;
  risk_tree: string[] | null;
  risk_grass: string[] | null;
  risk_weed: string[] | null;
  tz: string | null;
};

export type DaySummary = {
  date: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  risk_tree: string | null;
  risk_grass: string | null;
  risk_weed: string | null;
  timezone: string | null;
};

const reduceRisk = (labels: string[] | null | undefined): string | null => {
  if (!labels || !labels.length) return null;
  return labels.reduce<string | null>((acc, label) => pickHigherRisk(acc, label), null);
};

export function buildMapFeatureCollection(
  rows: DailyCityRow[],
  coords: Record<string, [number, number]>,
  date: string,
) {
  const byCity = new Map<string, DaySummary[]>();
  for (const r of rows) {
    const summary: DaySummary = {
      date: r.date,
      tree: r.tree ?? null,
      grass: r.grass ?? null,
      weed: r.weed ?? null,
      risk_tree: reduceRisk(r.risk_tree),
      risk_grass: reduceRisk(r.risk_grass),
      risk_weed: reduceRisk(r.risk_weed),
      timezone: r.tz ?? null,
    };
    const list = byCity.get(r.city_slug);
    if (list) list.push(summary);
    else byCity.set(r.city_slug, [summary]);
  }

  const features = Array.from(byCity.entries()).map(([city, series]) => {
    series.sort((a, b) => a.date.localeCompare(b.date));
    const baseDay: DaySummary = series.find((s) => s.date === date) || series[0] || {
      date,
      tree: null,
      grass: null,
      weed: null,
      risk_tree: null,
      risk_grass: null,
      risk_weed: null,
      timezone: null,
    };
    if (!series.length) series.push(baseDay);
    const timezone = baseDay.timezone ?? series.find((s) => s.timezone)?.timezone ?? null;
    const lonlat = coords[city] || [0, 0];
    const sevTree = riskScore(baseDay.risk_tree);
    const sevGrass = riskScore(baseDay.risk_grass);
    const sevWeed = riskScore(baseDay.risk_weed);
    return {
      type: 'Feature',
      properties: {
        city,
        count: (baseDay.grass ?? 0) + (baseDay.tree ?? 0) + (baseDay.weed ?? 0),
        tree: baseDay.tree ?? null,
        grass: baseDay.grass ?? null,
        weed: baseDay.weed ?? null,
        max_weed: baseDay.weed ?? 0,
        sev_tree: sevTree,
        sev_grass: sevGrass,
        sev_weed: sevWeed,
        sev_total: Math.max(sevTree, sevGrass, sevWeed),
        risk_tree: baseDay.risk_tree ?? null,
        risk_grass: baseDay.risk_grass ?? null,
        risk_weed: baseDay.risk_weed ?? null,
        timezone,
        series,
      },
      geometry: { type: 'Point', coordinates: lonlat },
    };
  });

  return { type: 'FeatureCollection', features };
}
