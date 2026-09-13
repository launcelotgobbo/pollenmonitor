'use client';

import { formatNumeric } from '@/components/CityDaily/format';
import type { DailySummary } from '@/components/CityDaily/types';

type Props = {
  days: DailySummary[];
  selected?: string | null;
  onSelect?: (date: string) => void;
};

const shortFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function formatDateLabel(value: string) {
  try {
    return shortFormatter.format(new Date(`${value}T00:00:00Z`));
  } catch {
    return value;
  }
}

export default function CityDailySummaryList({ days, selected, onSelect }: Props) {
  if (!days.length) {
    return <p className="text-sm text-slate-500">No daily data captured yet for this city.</p>;
  }

  return (
    <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
      {days.map((day) => {
        const isSelected = selected === day.date;
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelect?.(day.date)}
            className={`flex w-full flex-col rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
              isSelected
                ? 'border-sky-500 bg-sky-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}
                >
                  {formatDateLabel(day.date)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Avg {formatNumeric(day.total)} · Peak {formatNumeric(day.peak_total)} grains/m³
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {isSelected ? 'Viewing' : 'Select'}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-500">
              <div className="space-y-1">
                <dt className="font-medium uppercase tracking-wide text-slate-400">Tree avg</dt>
                <dd
                  className={`text-sm font-semibold ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}
                >
                  {formatNumeric(day.tree)}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium uppercase tracking-wide text-slate-400">Grass avg</dt>
                <dd
                  className={`text-sm font-semibold ${isSelected ? 'text-lime-700' : 'text-slate-700'}`}
                >
                  {formatNumeric(day.grass)}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium uppercase tracking-wide text-slate-400">Ragweed avg</dt>
                <dd
                  className={`text-sm font-semibold ${isSelected ? 'text-amber-700' : 'text-slate-700'}`}
                >
                  {formatNumeric(day.weed)}
                </dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}
