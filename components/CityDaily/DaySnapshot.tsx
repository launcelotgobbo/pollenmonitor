'use client';

import React from 'react';
import { formatLongDate, formatNumeric, riskBadgeClass } from './format';
import type { DailySummary, WeatherDaily } from './types';
import SpeciesBreakdown from './SpeciesBreakdown';

type Props = {
  selectedDate: string | null;
  selectedDaily: DailySummary | null;
  weatherRows: WeatherDaily[];
  timezone: string;
  isLoadingWeather: boolean;
  weatherError: string | null;
};

function StatCard({
  label,
  average,
  peak,
  risk,
  valueClass = 'text-slate-900',
}: {
  label: string;
  average: number | null | undefined;
  peak: number | null | undefined;
  risk?: string | null;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {risk ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskBadgeClass(risk)}`}
          >
            {risk}
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className={`text-2xl font-semibold tabular-nums ${valueClass}`}>
            {formatNumeric(average)}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Average</p>
        </div>
        <div className="border-l border-slate-200 pl-3">
          <p className="text-2xl font-semibold tabular-nums text-slate-700">
            {formatNumeric(peak)}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Peak</p>
        </div>
      </div>
    </div>
  );
}

function WeatherStat({
  label,
  value,
  valueClass = 'text-slate-900',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function DaySnapshot({
  selectedDate,
  selectedDaily,
  weatherRows,
  timezone,
  isLoadingWeather,
  weatherError,
}: Props) {
  const selectedLabel = formatLongDate(selectedDate);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Latest daily detail
            </p>
            <p className="text-xs text-slate-500">
              {selectedLabel
                ? `${selectedLabel}. Daily averages and highest observed values.`
                : 'No daily detail is available.'}
            </p>
          </div>
          {selectedLabel ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {timezone}
            </span>
          ) : null}
        </div>

        {selectedDaily ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Total" average={selectedDaily.total} peak={selectedDaily.peak_total} />
            <StatCard
              label="Tree"
              average={selectedDaily.tree}
              peak={selectedDaily.peak_tree}
              risk={selectedDaily.peak_risk_tree}
              valueClass="text-emerald-700"
            />
            <StatCard
              label="Grass"
              average={selectedDaily.grass}
              peak={selectedDaily.peak_grass}
              risk={selectedDaily.peak_risk_grass}
              valueClass="text-lime-700"
            />
            <StatCard
              label="Ragweed"
              average={selectedDaily.weed}
              peak={selectedDaily.peak_weed}
              risk={selectedDaily.peak_risk_weed}
              valueClass="text-amber-700"
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No daily data is available. Try a different city.
          </p>
        )}

        <p className="text-[11px] leading-4 text-slate-500">
          Values are modeled grains/m³. Risk badges use the daily peak for each category.
        </p>

        <SpeciesBreakdown species={selectedDaily?.species ?? null} />

        {weatherRows.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <WeatherStat label="AQI (OWM 1–5)" value={formatNumeric(weatherRows[0]?.aqi ?? null)} />
            <WeatherStat
              label="Temp (day °C)"
              value={formatNumeric(weatherRows[0]?.temp_day_c ?? null)}
              valueClass="text-blue-700"
            />
            <WeatherStat
              label="Temp range (°C)"
              value={`${formatNumeric(weatherRows[0]?.temp_min_c ?? null)} – ${formatNumeric(weatherRows[0]?.temp_max_c ?? null)}`}
              valueClass="text-slate-700"
            />
          </div>
        ) : null}
        {isLoadingWeather ? <p className="text-xs text-slate-500">Loading daily weather…</p> : null}
        {weatherError ? <p className="text-xs text-slate-500">{weatherError}</p> : null}
      </div>
    </div>
  );
}
