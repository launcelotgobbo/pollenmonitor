import { pollenRisk, riskScore, type PollenRisk } from '@/lib/risk';

export const MAP_AGGREGATION = 'daily-category-maxima';

// One SQL-aggregated row per (city, UTC day): daily category maxima and the
// largest species value in each category, used for category-specific NAB risk.
export type DailyCityRow = {
  city_slug: string;
  date: string; // YYYY-MM-DD (UTC)
  tree: number | null;
  grass: number | null;
  weed: number | null;
  max_species_tree: number | null;
  max_species_grass: number | null;
  max_species_weed: number | null;
  ragweed: number | null;
  tz: string | null;
};

export type DaySummary = {
  date: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  ragweed: number | null;
  risk_tree: PollenRisk | null;
  risk_grass: PollenRisk | null;
  risk_weed: PollenRisk | null;
  risk_ragweed: PollenRisk | null;
  timezone: string | null;
};

export function buildMapFeatureCollection(
  rows: DailyCityRow[],
  coords: Record<string, [number, number]>,
  date: string,
) {
  const byCity = new Map<string, DaySummary[]>();
  for (const r of rows) {
    // Older rows predate species storage. Weed was Ragweed-only for this
    // dataset, so retain their useful map signal instead of showing no data.
    const ragweed = r.ragweed ?? r.weed;
    const summary: DaySummary = {
      date: r.date,
      tree: r.tree ?? null,
      grass: r.grass ?? null,
      weed: r.weed ?? null,
      ragweed,
      risk_tree: pollenRisk('tree', r.max_species_tree ?? r.tree),
      risk_grass: pollenRisk('grass', r.max_species_grass ?? r.grass),
      risk_weed: pollenRisk('weed', r.max_species_weed ?? r.weed),
      risk_ragweed: pollenRisk('weed', ragweed),
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
      ragweed: null,
      risk_tree: null,
      risk_grass: null,
      risk_weed: null,
      risk_ragweed: null,
      timezone: null,
    };
    if (!series.length) series.push(baseDay);
    const timezone = baseDay.timezone ?? series.find((s) => s.timezone)?.timezone ?? null;
    const lonlat = coords[city] || [0, 0];
    const sevTree = riskScore(baseDay.risk_tree);
    const sevGrass = riskScore(baseDay.risk_grass);
    const sevWeed = riskScore(baseDay.risk_weed);
    const sevRagweed = riskScore(baseDay.risk_ragweed);
    return {
      type: 'Feature',
      properties: {
        city,
        value_basis: MAP_AGGREGATION,
        count: (baseDay.grass ?? 0) + (baseDay.tree ?? 0) + (baseDay.weed ?? 0),
        tree: baseDay.tree ?? null,
        grass: baseDay.grass ?? null,
        weed: baseDay.weed ?? null,
        ragweed: baseDay.ragweed ?? null,
        max_weed: baseDay.weed ?? 0,
        sev_tree: sevTree,
        sev_grass: sevGrass,
        sev_weed: sevWeed,
        sev_ragweed: sevRagweed,
        sev_total: Math.max(sevTree, sevGrass, sevWeed),
        risk_tree: baseDay.risk_tree ?? null,
        risk_grass: baseDay.risk_grass ?? null,
        risk_weed: baseDay.risk_weed ?? null,
        risk_ragweed: baseDay.risk_ragweed ?? null,
        timezone,
        series,
      },
      geometry: { type: 'Point', coordinates: lonlat },
    };
  });

  return {
    type: 'FeatureCollection',
    aggregation: MAP_AGGREGATION,
    features,
  };
}
