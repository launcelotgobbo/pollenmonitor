import type { PollenRisk } from '@/lib/risk';
import type { SpeciesBreakdown } from '@/lib/species';

export type DailySummary = {
  date: string;
  avg_tree: number | null;
  avg_grass: number | null;
  avg_weed: number | null;
  avg_total: number | null;
  timezone: string | null;
  species: SpeciesBreakdown | null;
  risk_tree: PollenRisk | null;
  risk_grass: PollenRisk | null;
  risk_weed: PollenRisk | null;
};

export type HourlyRow = {
  ts: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  risk_tree: PollenRisk | null;
  risk_grass: PollenRisk | null;
  risk_weed: PollenRisk | null;
  timezone: string | null;
  species: unknown;
};

export type WeatherDaily = {
  date: string;
  aqi: number | null;
  temp_day_c: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
};
