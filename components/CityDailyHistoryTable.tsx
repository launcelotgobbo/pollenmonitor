import React from 'react';
import { formatLongDate, formatNumeric } from '@/components/CityDaily/format';
import type { DailyPollenHistoryRow } from '@/lib/pollen-types';

type NumericHistoryKey = Exclude<keyof DailyPollenHistoryRow, 'date'>;

const HISTORY_METRICS: {
  label: string;
  averageKey: NumericHistoryKey;
  peakKey: NumericHistoryKey;
  averageClassName?: string;
}[] = [
  { label: 'Total', averageKey: 'total', peakKey: 'peak_total' },
  {
    label: 'Tree',
    averageKey: 'tree',
    peakKey: 'peak_tree',
    averageClassName: 'text-emerald-700',
  },
  {
    label: 'Grass',
    averageKey: 'grass',
    peakKey: 'peak_grass',
    averageClassName: 'text-lime-700',
  },
  {
    label: 'Ragweed',
    averageKey: 'weed',
    peakKey: 'peak_weed',
    averageClassName: 'text-amber-700',
  },
];

export default function CityDailyHistoryTable({ days }: { days: DailyPollenHistoryRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Complete daily history
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Average and peak modeled grains/m³ for all {days.length.toLocaleString('en-US')} captured
          days. Scroll sideways on smaller screens.
        </p>
      </div>

      {days.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[62rem] w-full border-collapse text-right text-sm">
            <caption className="sr-only">
              Complete daily pollen averages and peaks, newest first
            </caption>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-10 min-w-44 bg-slate-50 px-4 py-3 text-left sm:px-6"
                >
                  Date
                </th>
                {HISTORY_METRICS.map((metric) => (
                  <th
                    key={metric.label}
                    colSpan={2}
                    scope="colgroup"
                    className="px-3 py-2 text-center"
                  >
                    {metric.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-slate-200">
                {HISTORY_METRICS.flatMap((metric) => [
                  <th key={`${metric.label}-average`} scope="col" className="px-3 py-2 font-medium">
                    Average
                  </th>,
                  <th key={`${metric.label}-peak`} scope="col" className="px-3 py-2 font-medium">
                    Peak
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {days.map((day, index) => (
                <tr key={day.date} className={index === 0 ? 'bg-sky-50/70' : 'hover:bg-slate-50'}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-800 sm:px-6 ${
                      index === 0 ? 'bg-sky-50' : 'bg-white'
                    }`}
                  >
                    {formatLongDate(day.date)}
                    {index === 0 ? (
                      <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                        Latest
                      </span>
                    ) : null}
                  </th>
                  {HISTORY_METRICS.flatMap((metric) => [
                    <td
                      key={`${metric.label}-average`}
                      className={`px-3 py-3 tabular-nums ${metric.averageClassName ?? ''}`}
                    >
                      {formatNumeric(day[metric.averageKey])}
                    </td>,
                    <td
                      key={`${metric.label}-peak`}
                      className="px-3 py-3 font-semibold tabular-nums"
                    >
                      {formatNumeric(day[metric.peakKey])}
                    </td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-slate-500 sm:px-6">
          No daily data has been captured for this city.
        </p>
      )}
    </section>
  );
}
