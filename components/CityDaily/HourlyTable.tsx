'use client';

import { useMemo } from 'react';
import { formatLongDate, getTimeFormatter, riskBadgeClass } from './format';
import type { HourlyRow } from './types';

type Props = {
  hourlyRows: HourlyRow[];
  timezone: string;
  selectedDate: string | null;
  isLoading: boolean;
  error: string | null;
};

function RiskBadge({ label, value }: { label: string; value: string | null }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${riskBadgeClass(value)}`}
    >
      {label} {value ?? '—'}
    </span>
  );
}

export default function HourlyTable({ hourlyRows, timezone, selectedDate, isLoading, error }: Props) {
  const formatter = useMemo(() => getTimeFormatter(timezone), [timezone]);
  const selectedLabel = formatLongDate(selectedDate);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {hourlyRows.length ? (
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-xs sm:text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Time ({timezone})</th>
                <th className="px-4 py-3 text-right">Tree</th>
                <th className="px-4 py-3 text-right">Grass</th>
                <th className="px-4 py-3 text-right">Weed</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hourlyRows.map((row) => {
                const rawLabel = formatter.format(new Date(row.ts));
                const timeLabel = rawLabel.startsWith('24:') ? rawLabel.replace(/^24:/, '00:') : rawLabel;
                const treeValue = typeof row.tree === 'number' ? row.tree.toLocaleString('en-US') : '—';
                const grassValue = typeof row.grass === 'number' ? row.grass.toLocaleString('en-US') : '—';
                const weedValue = typeof row.weed === 'number' ? row.weed.toLocaleString('en-US') : '—';
                const totalValue = typeof row.total === 'number' ? row.total.toLocaleString('en-US') : '—';
                return (
                  <tr key={row.ts} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{timeLabel}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">{treeValue}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-lime-700">{grassValue}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-amber-700">{weedValue}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">{totalValue}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[18rem] flex-wrap gap-2">
                        <RiskBadge label="Tree" value={row.risk_tree} />
                        <RiskBadge label="Grass" value={row.risk_grass} />
                        <RiskBadge label="Weed" value={row.risk_weed} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-slate-600">
            {selectedLabel ? 'No hourly readings found for this day.' : 'Select a day to view hourly readings.'}
          </p>
          <p className="mt-2 text-xs text-slate-500">Try a different date or city if data is missing.</p>
        </div>
      )}

      {isLoading ? (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
          Loading hourly data…
        </div>
      ) : null}
      {error ? (
        <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-center text-xs font-medium text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
