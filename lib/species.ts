export type SpeciesBreakdown = Record<string, Record<string, number>>;

export type SpeciesAccumulator = Map<string, Map<string, { sum: number; count: number }>>;

function findSpeciesCategory(value: unknown, category: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.entries(value).find(([key]) => key.toLowerCase() === category.toLowerCase())?.[1] ?? null;
}

// Mirrors the SQL filter in numericSpeciesEntriesSql: only numbers and
// non-empty numeric strings count. Number(null) / Number('') would coerce to
// 0, and a species max of 0 overrides the category count in pollenRisk.
function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeNumericRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries: Array<[string, number]> = [];
  for (const [name, rawValue] of Object.entries(value)) {
    const parsed = toFiniteNumber(rawValue);
    if (parsed !== null) entries.push([name, parsed]);
  }
  return entries.length ? Object.fromEntries(entries) : null;
}

export function normalizeSpecies(value: unknown): SpeciesBreakdown | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const normalized: SpeciesBreakdown = {};
  for (const [category, rawSpecies] of Object.entries(value)) {
    const values = normalizeNumericRecord(rawSpecies);
    if (values) normalized[category] = values;
  }

  return Object.keys(normalized).length ? normalized : null;
}

export function addSpecies(accumulator: SpeciesAccumulator, value: unknown) {
  const species = normalizeSpecies(value);
  if (!species) return;

  for (const [category, values] of Object.entries(species)) {
    const categoryValues = accumulator.get(category) ?? new Map<string, { sum: number; count: number }>();
    accumulator.set(category, categoryValues);
    for (const [name, amount] of Object.entries(values)) {
      const current = categoryValues.get(name) ?? { sum: 0, count: 0 };
      current.sum += amount;
      current.count += 1;
      categoryValues.set(name, current);
    }
  }
}

export function averageSpecies(accumulator: SpeciesAccumulator): SpeciesBreakdown | null {
  const species: SpeciesBreakdown = {};
  for (const [category, values] of accumulator.entries()) {
    const averaged = Object.fromEntries(
      Array.from(values.entries()).map(([name, amount]) => [
        name,
        Math.round(amount.sum / amount.count),
      ]),
    );
    if (Object.keys(averaged).length) species[category] = averaged;
  }
  return Object.keys(species).length ? species : null;
}

export function getSpeciesCategory(
  species: unknown,
  category: string,
): Record<string, number> | null {
  return normalizeNumericRecord(findSpeciesCategory(species, category));
}

export function maxSpeciesValue(species: unknown, category: string): number | null {
  const values = getSpeciesCategory(species, category);
  return values ? Math.max(...Object.values(values)) : null;
}
