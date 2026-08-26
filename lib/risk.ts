import { maxSpeciesValue } from '@/lib/species';

export const riskPriority: Record<string, number> = {
  'very-high': 5,
  extreme: 5,
  severe: 4,
  high: 3,
  moderate: 2,
  medium: 2,
  low: 1,
  none: 0,
  'very-low': 0,
  minimal: 0,
};

export const NAB_THRESHOLDS = {
  weed: [10, 50, 500],
  grass: [5, 20, 200],
  tree: [15, 90, 1500],
} as const;

export type PollenCategory = keyof typeof NAB_THRESHOLDS;
export type PollenRisk = 'None' | 'Low' | 'Moderate' | 'High' | 'Very High';

export function normalizeRiskValue(value: string | null | undefined) {
  if (!value) return null;
  return value.toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/_+/g, '-');
}

// 0..5 severity score; -1 when the risk label is missing or unrecognized
export function riskScore(value: string | null | undefined): number {
  const norm = normalizeRiskValue(value);
  return norm !== null && norm in riskPriority ? riskPriority[norm] : -1;
}

export function pickHigherRisk<T extends string>(
  a: T | null | undefined,
  b: T | null | undefined,
): T | null {
  const normA = normalizeRiskValue(a);
  const normB = normalizeRiskValue(b);
  const scoreA = normA !== null && normA in riskPriority ? riskPriority[normA] : -1;
  const scoreB = normB !== null && normB in riskPriority ? riskPriority[normB] : -1;
  if (scoreB > scoreA) return b ?? null;
  return a ?? (b ?? null);
}

export function pollenRisk(
  category: PollenCategory,
  value: number | null | undefined,
  species?: unknown,
): PollenRisk | null {
  const categoryValue = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const basis = maxSpeciesValue(species, category) ?? categoryValue;
  if (basis === null) return null;

  const [moderate, high, veryHigh] = NAB_THRESHOLDS[category];
  if (basis >= veryHigh) return 'Very High';
  if (basis >= high) return 'High';
  if (basis >= moderate) return 'Moderate';
  if (basis > 0) return 'Low';
  return 'None';
}

type PollenMeasurements = {
  tree?: number | null;
  grass?: number | null;
  weed?: number | null;
  species?: unknown;
};

export function withNabRisk<T extends PollenMeasurements>(row: T) {
  return {
    ...row,
    risk_tree: pollenRisk('tree', row.tree, row.species),
    risk_grass: pollenRisk('grass', row.grass, row.species),
    risk_weed: pollenRisk('weed', row.weed, row.species),
  };
}
