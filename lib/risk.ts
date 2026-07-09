export const riskPriority: Record<string, number> = {
  'very-high': 5,
  extreme: 5,
  severe: 4,
  high: 3,
  moderate: 2,
  medium: 2,
  low: 1,
  'very-low': 0,
  minimal: 0,
};

export function normalizeRiskValue(value: string | null | undefined) {
  if (!value) return null;
  return value.toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/_+/g, '-');
}

export function pickHigherRisk(a: string | null | undefined, b: string | null | undefined) {
  const normA = normalizeRiskValue(a);
  const normB = normalizeRiskValue(b);
  const scoreA = normA !== null && normA in riskPriority ? riskPriority[normA] : -1;
  const scoreB = normB !== null && normB in riskPriority ? riskPriority[normB] : -1;
  if (scoreB > scoreA) return b ?? null;
  return a ?? (b ?? null);
}
