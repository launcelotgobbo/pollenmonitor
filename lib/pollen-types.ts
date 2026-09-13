import type { PollenRisk } from '@/lib/risk';
import type { SpeciesBreakdown } from '@/lib/species';

export type DailyPollenRow = {
  date: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  peak_tree: number | null;
  peak_grass: number | null;
  peak_weed: number | null;
  peak_total: number | null;
  timezone: string | null;
  species: SpeciesBreakdown | null;
  risk_tree: PollenRisk | null;
  risk_grass: PollenRisk | null;
  risk_weed: PollenRisk | null;
  peak_risk_tree: PollenRisk | null;
  peak_risk_grass: PollenRisk | null;
  peak_risk_weed: PollenRisk | null;
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
