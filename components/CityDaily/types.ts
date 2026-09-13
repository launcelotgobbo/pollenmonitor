import type { DailyPollenRow } from '@/lib/pollen-types';

export type DailySummary = DailyPollenRow;

export type WeatherDaily = {
  date: string;
  aqi: number | null;
  temp_day_c: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
};
