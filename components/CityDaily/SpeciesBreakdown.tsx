import { getSpeciesCategory, type SpeciesBreakdown as SpeciesData } from '@/lib/species';
import { formatNumeric } from './format';

const CATEGORIES = [
  { key: 'Tree', label: 'Tree', barClass: 'bg-emerald-500' },
  { key: 'Grass', label: 'Grass', barClass: 'bg-lime-500' },
  { key: 'Weed', label: 'Ragweed', barClass: 'bg-amber-500' },
] as const;

export default function SpeciesBreakdown({ species }: { species: SpeciesData | null }) {
  const categories = CATEGORIES.map((category) => ({
    ...category,
    values: Object.entries(getSpeciesCategory(species, category.key) ?? {}).sort((a, b) => b[1] - a[1]),
  })).filter((category) => category.values.length);

  if (!categories.length) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Species breakdown</p>
        <p className="text-[11px] text-slate-500">Daily average grains/m³ for each reported allergen.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {categories.map((category) => {
          const maxValue = Math.max(...category.values.map(([, value]) => value), 0);
          return (
            <div key={category.key} className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">{category.label}</p>
              {category.values.map(([name, value]) => {
                const width = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 2 : 0) : 0;
                return (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-slate-600" title={name}>{name}</span>
                      <span className="font-medium tabular-nums text-slate-700">{formatNumeric(value)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${category.barClass}`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
