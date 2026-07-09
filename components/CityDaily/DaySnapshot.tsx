'use client';

import { useMemo } from 'react';
import { formatLongDate, formatNumeric } from './format';
import type { DailySummary, HourlyRow, WeatherDaily } from './types';

type Props = {
  selectedDate: string | null;
  selectedDaily: DailySummary | null;
  hourlyRows: HourlyRow[];
  weatherRows: WeatherDaily[];
  timezone: string;
};

function StatCard({ label, value, valueClass = 'text-slate-900', footnote }: {
  label: string;
  value: string;
  valueClass?: string;
  footnote?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 shadow-inner">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
      {footnote ? <p className="mt-2 text-[11px] text-slate-500">{footnote}</p> : null}
    </div>
  );
}

export default function DaySnapshot({ selectedDate, selectedDaily, hourlyRows, weatherRows, timezone }: Props) {
  const summary = useMemo(() => {
    return hourlyRows.reduce(
      (acc, row) => {
        const tree = typeof row.tree === 'number' ? row.tree : 0;
        const grass = typeof row.grass === 'number' ? row.grass : 0;
        const weed = typeof row.weed === 'number' ? row.weed : 0;
        const total = typeof row.total === 'number' ? row.total : tree + grass + weed;
        return {
          maxTree: Math.max(acc.maxTree, tree),
          maxGrass: Math.max(acc.maxGrass, grass),
          maxWeed: Math.max(acc.maxWeed, weed),
          maxTotal: Math.max(acc.maxTotal, total),
          totalCount: acc.totalCount + total,
          sampleCount: acc.sampleCount + 1,
        };
      },
      { maxTree: 0, maxGrass: 0, maxWeed: 0, maxTotal: 0, totalCount: 0, sampleCount: 0 },
    );
  }, [hourlyRows]);

  const averageTotal = summary.sampleCount ? Math.round(summary.totalCount / summary.sampleCount) : null;
  const selectedLabel = formatLongDate(selectedDate);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Selected day snapshot</p>
            <p className="text-xs text-slate-500">
              {selectedLabel
                ? `Averages and peaks derived from ${selectedLabel}.`
                : 'Pick a day from the list to view hourly details.'}
            </p>
          </div>
          {selectedLabel ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {timezone}
            </span>
          ) : null}
        </div>

        {selectedDaily ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Avg total" value={formatNumeric(selectedDaily.avg_total)} footnote="particles/m³" />
            <StatCard label="Avg tree" value={formatNumeric(selectedDaily.avg_tree)} valueClass="text-emerald-700" />
            <StatCard label="Avg grass" value={formatNumeric(selectedDaily.avg_grass)} valueClass="text-lime-700" />
            <StatCard label="Avg weed" value={formatNumeric(selectedDaily.avg_weed)} valueClass="text-amber-700" />
          </div>
        ) : (
          <p className="text-sm text-slate-500">No averages available yet. Try a different city.</p>
        )}

        {weatherRows.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="AQI (OWM 1–5)" value={formatNumeric(weatherRows[0]?.aqi ?? null)} />
            <StatCard label="Temp (day °C)" value={formatNumeric(weatherRows[0]?.temp_day_c ?? null)} valueClass="text-blue-700" />
            <StatCard
              label="Temp range (°C)"
              value={`${formatNumeric(weatherRows[0]?.temp_min_c ?? null)} – ${formatNumeric(weatherRows[0]?.temp_max_c ?? null)}`}
              valueClass="text-slate-700"
            />
          </div>
        ) : null}

        {hourlyRows.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Peak total" value={summary.maxTotal.toLocaleString('en-US')} />
            <StatCard label="Peak weed" value={summary.maxWeed.toLocaleString('en-US')} valueClass="text-amber-700" />
            <StatCard
              label="Hourly samples"
              value={summary.sampleCount.toLocaleString('en-US')}
              footnote={averageTotal != null ? `Avg total per hour: ${averageTotal.toLocaleString('en-US')}` : undefined}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
