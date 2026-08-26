import type { PollenRisk } from '@/lib/risk';
import type { SpeciesBreakdown } from '@/lib/species';

export type DailyPollenRow = {
  date: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  timezone: string | null;
  species: SpeciesBreakdown | null;
  risk_tree: PollenRisk | null;
  risk_grass: PollenRisk | null;
  risk_weed: PollenRisk | null;
};

export type HourlyPollenRow = {
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
