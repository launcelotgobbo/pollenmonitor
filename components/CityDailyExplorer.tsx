'use client';

import { useMemo } from 'react';
import DaySnapshot from '@/components/CityDaily/DaySnapshot';
import HourlyTable from '@/components/CityDaily/HourlyTable';
import { useCityDayData } from '@/components/CityDaily/useCityDayData';
import type { DailySummary, HourlyRow } from '@/components/CityDaily/types';
import CityDailySummaryList from '@/components/CityDailySummaryList';
import CityPicker from '@/components/CityPicker';

export type { DailySummary, HourlyRow } from '@/components/CityDaily/types';

type Props = {
  city: string;
  summaries: DailySummary[];
  initialSelected: string | null;
  initialHourly: HourlyRow[];
  initialTimezone: string | null;
};

export default function CityDailyExplorer({ city, summaries, initialSelected, initialHourly, initialTimezone }: Props) {
  const { selectedDate, hourlyRows, timezone, weatherRows, isLoading, error, handleSelect } = useCityDayData({
    city,
    initialSelected,
    initialHourly,
    initialTimezone,
  });

  const selectedDaily = useMemo(
    () => summaries.find((row) => row.date === selectedDate) ?? null,
    [summaries, selectedDate],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <CityPicker current={city} />
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-600">Daily averages</p>
              <p className="text-xs text-slate-500">
                Rounded mean counts per category across the last {summaries.length.toLocaleString('en-US')} day(s).
              </p>
            </div>
            <CityDailySummaryList days={summaries} selected={selectedDate ?? undefined} onSelect={handleSelect} />
          </div>
        </div>
      </aside>

      <section className="space-y-6">
        <DaySnapshot
          selectedDate={selectedDate ?? null}
          selectedDaily={selectedDaily}
          hourlyRows={hourlyRows}
          weatherRows={weatherRows}
          timezone={timezone}
        />
        <HourlyTable
          hourlyRows={hourlyRows}
          timezone={timezone}
          selectedDate={selectedDate ?? null}
          isLoading={isLoading}
          error={error}
        />
      </section>
    </div>
  );
}
