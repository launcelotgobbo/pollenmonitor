'use client';

import DaySnapshot from '@/components/CityDaily/DaySnapshot';
import { useDailyWeather } from '@/components/CityDaily/useDailyWeather';
import type { DailySummary } from '@/components/CityDaily/types';
import CityPicker, { type CityOption } from '@/components/CityPicker';

export type { DailySummary } from '@/components/CityDaily/types';

type Props = {
  city: string;
  cities: CityOption[];
  latestDaily: DailySummary | null;
};

export default function CityDailyExplorer({ city, cities, latestDaily }: Props) {
  const { weatherRows, isLoadingWeather, weatherError } = useDailyWeather({
    city,
    date: latestDaily?.date ?? null,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="max-w-sm">
          <CityPicker cities={cities} current={city} />
        </div>
      </div>

      <DaySnapshot
        selectedDate={latestDaily?.date ?? null}
        selectedDaily={latestDaily}
        weatherRows={weatherRows}
        timezone={latestDaily?.timezone || 'UTC'}
        isLoadingWeather={isLoadingWeather}
        weatherError={weatherError}
      />
    </div>
  );
}
