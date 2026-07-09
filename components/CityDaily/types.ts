export type DailySummary = {
  date: string;
  avg_tree: number | null;
  avg_grass: number | null;
  avg_weed: number | null;
  avg_total: number | null;
  timezone: string | null;
};

export type HourlyRow = {
  ts: string;
  tree: number | null;
  grass: number | null;
  weed: number | null;
  total: number | null;
  risk_tree: string | null;
  risk_grass: string | null;
  risk_weed: string | null;
  timezone: string | null;
};

export type WeatherDaily = {
  date: string;
  aqi: number | null;
  temp_day_c: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
};
