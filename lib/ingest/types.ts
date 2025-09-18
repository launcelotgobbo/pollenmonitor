export type ProviderReading = {
  lat: number;
  lon: number;
  date: string; // YYYY-MM-DD
  grass?: number | null;
  tree?: number | null;
  weed?: number | null;
  total?: number | null;
  source: 'ambee' | 'google';
};

export type CityTarget = {
  name: string;
  slug: string;
  lat: number;
  lon: number;
};

