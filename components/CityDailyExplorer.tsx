'use client';

import { useMemo } from 'react';
import DaySnapshot from '@/components/CityDaily/DaySnapshot';
import { useDailySelection } from '@/components/CityDaily/useDailySelection';
import type { DailySummary } from '@/components/CityDaily/types';
import CityDailySummaryList from '@/components/CityDailySummaryList';
import CityPicker, { type CityOption } from '@/components/CityPicker';

export type { DailySummary } from '@/components/CityDaily/types';

type Props = {
  city: string;
  cities: CityOption[];
  summaries: DailySummary[];
  initialSelected: string | null;
};

const HISTORY_LIMIT = 90;

export default function CityDailyExplorer({ city, cities, summaries, initialSelected }: Props) {
  const { selectedDate, weatherRows, isLoadingWeather, weatherError, handleSelect } =
    useDailySelection({
      city,
      initialSelected,
    });

  const selectedDaily = useMemo(
    () => summaries.find((row) => row.date === selectedDate) ?? null,
    [summaries, selectedDate],
  );
  const timezone = selectedDaily?.timezone || 'UTC';
  const visibleSummaries = useMemo(() => {
    const recent = summaries.slice(0, HISTORY_LIMIT);
    if (!selectedDaily || recent.some((day) => day.date === selectedDaily.date)) return recent;
    return [selectedDaily, ...recent];
  }, [selectedDaily, summaries]);

  return (
    <div className="grid gap-4 xl:grid-cols-[320px,1fr] xl:gap-6">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:hidden">
        <CityPicker cities={cities} current={city} id="city-picker-mobile" />
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-600" htmlFor="daily-date-mobile">
            Day
          </label>
          <select
            id="daily-date-mobile"
            value={selectedDate ?? ''}
            onChange={(event) => handleSelect(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            {visibleSummaries.map((day) => (
              <option key={day.date} value={day.date}>
                {day.date}
              </option>
            ))}
          </select>
        </div>
      </div>

      <aside className="hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:block">
        <div className="space-y-6">
          <CityPicker cities={cities} current={city} />
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-600">Daily history</p>
              <p className="text-xs text-slate-500">
                Average and peak counts for the latest {visibleSummaries.length} days.
              </p>
            </div>
            <CityDailySummaryList
              days={visibleSummaries}
              selected={selectedDate ?? undefined}
              onSelect={handleSelect}
            />
          </div>
        </div>
      </aside>

      <section className="space-y-4 xl:space-y-6">
        <DaySnapshot
          selectedDate={selectedDate ?? null}
          selectedDaily={selectedDaily}
          weatherRows={weatherRows}
          timezone={timezone}
          isLoadingWeather={isLoadingWeather}
          weatherError={weatherError}
        />
      </section>
    </div>
  );
}
