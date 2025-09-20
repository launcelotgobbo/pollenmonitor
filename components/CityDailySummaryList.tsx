'use client';

import { useMemo } from 'react';

type DailySummary = {
  date: string;
  avg_tree: number | null;
  avg_grass: number | null;
  avg_weed: number | null;
  avg_total: number | null;
  timezone: string | null;
};

type Props = {
  days: DailySummary[];
  selected?: string | null;
  onSelect?: (date: string) => void;
};

const longFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

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

function formatLongLabel(value: string) {
  try {
    return longFormatter.format(new Date(`${value}T00:00:00Z`));
  } catch {
    return value;
  }
}

function formatValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
}

export default function CityDailySummaryList({ days, selected, onSelect }: Props) {
  const items = useMemo(() => days ?? [], [days]);

  if (!items.length) {
    return <p className="text-sm text-slate-500">No daily data captured yet for this city.</p>;
  }

  return (
    <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
      {items.map((day) => {
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
                <p className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                  {formatDateLabel(day.date)}
                </p>
                <p className="text-[11px] text-slate-500">Avg total {formatValue(day.avg_total)} particles/m³</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{isSelected ? 'Viewing' : 'Select'}</span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-500 sm:grid-cols-4">
              <div className="space-y-1">
                <dt className="font-medium uppercase tracking-wide text-slate-400">Tree</dt>
                <dd className={`text-sm font-semibold ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {formatValue(day.avg_tree)}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium uppercase tracking-wide text-slate-400">Grass</dt>
                <dd className={`text-sm font-semibold ${isSelected ? 'text-lime-700' : 'text-slate-700'}`}>
                  {formatValue(day.avg_grass)}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="font-medium uppercase tracking-wide text-slate-400">Weed</dt>
                <dd className={`text-sm font-semibold ${isSelected ? 'text-amber-700' : 'text-slate-700'}`}>
                  {formatValue(day.avg_weed)}
                </dd>
              </div>
              <div className="hidden space-y-1 sm:block">
                <dt className="font-medium uppercase tracking-wide text-slate-400">Date</dt>
                <dd className="text-sm text-slate-600">{formatLongLabel(day.date)}</dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}
