import { ProviderReading } from './types';

// Prefer the Google Maps Pollen API domain for forecasts
const POLLEN_BASE = 'https://pollen.googleapis.com/v1';

function getGoogleKey(): string | undefined {
  return process.env.GOOGLE_POLLEN_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export type GooglePollenDay = {
  date: string;
  grassIndex?: number | null;
  treeIndex?: number | null;
  weedIndex?: number | null;
  plants?: Array<{
    code?: string;
    displayName?: string;
    type?: 'GRASS' | 'TREE' | 'WEED' | string;
    index?: number | null;
    category?: string | null;
    inSeason?: boolean | null;
    family?: string | null;
    season?: string | null;
  }>;
};

export async function googleLookup(lat: number, lon: number, date?: string): Promise<GooglePollenDay[]> {
  const today = new Date().toISOString().slice(0, 10);
  const want = date || today;

  const key = getGoogleKey();
  if (!key || process.env.USE_MOCK_DATA === 'true') {
    const today = new Date();
    const days = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().slice(0, 10),
        grassIndex: Math.floor(Math.random() * 5),
        treeIndex: Math.floor(Math.random() * 5),
        weedIndex: Math.floor(Math.random() * 5),
        plants: [
          { code: 'RAGWEED', displayName: 'Ragweed', type: 'WEED', index: Math.floor(Math.random() * 5), category: 'Moderate', inSeason: true },
          { code: 'OAK', displayName: 'Oak', type: 'TREE', index: Math.floor(Math.random() * 5), category: 'Low', inSeason: true },
          { code: 'GRAMINALES', displayName: 'Grasses', type: 'GRASS', index: Math.floor(Math.random() * 5), category: 'Low', inSeason: true },
        ],
      } as GooglePollenDay;
    });
    return days;
  }

  // Use the Pollen API forecast endpoint; includes dailyInfo with plantInfo
  const params = new URLSearchParams({
    'location.latitude': String(lat),
    'location.longitude': String(lon),
    days: '5',
    key,
  });
  const url = `${POLLEN_BASE}/forecast:lookup?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google pollen forecast failed (${res.status}) ${text.slice(0, 200)}`);
  }
  const json = await res.json();

  const days = (json?.dailyInfo || []) as any[];
  const plantsMeta = json?.plantInfo || [];

  const out: GooglePollenDay[] = days.map((d: any) => {
    const date = d?.date
      ? `${d.date.year}-${String(d.date.month).padStart(2, '0')}-${String(d.date.day).padStart(2, '0')}`
      : new Date().toISOString().slice(0, 10);
    // pollenTypeInfo holds GRASS/TREE/WEED indices
    const pti = Array.isArray(d?.pollenTypeInfo) ? d.pollenTypeInfo : [];
    const getIndex = (code: string) => pti.find((x: any) => x?.code === code)?.indexInfo?.value ?? null;
    const grassIndex = getIndex('GRASS');
    const treeIndex = getIndex('TREE');
    const weedIndex = getIndex('WEED');
    const plants: GooglePollenDay['plants'] = (Array.isArray(d?.plantInfo) ? d.plantInfo : []).map((p: any) => ({
      code: p?.code,
      displayName: p?.displayName,
      type: p?.plantDescription?.type,
      index: p?.indexInfo?.value ?? null,
      category: p?.indexInfo?.category ?? null,
      inSeason: p?.inSeason ?? null,
      family: p?.plantDescription?.family ?? null,
      season: p?.plantDescription?.season ?? null,
    }));
    // If day-level plants missing, fall back to top-level plant metadata
    const mergedPlants = plants && plants.length ? plants : plantsMeta;
    return { date, grassIndex, treeIndex, weedIndex, plants: mergedPlants };
  });
  return out;
}

export async function googleForecast(lat: number, lon: number, date?: string): Promise<ProviderReading | null> {
  const days = await googleLookup(lat, lon, date);
  const d = date || new Date().toISOString().slice(0, 10);
  const match = days.find((x) => x.date === d) || days[0];
  if (!match) return null;
  const grass = match.grassIndex ?? null;
  const tree = match.treeIndex ?? null;
  const weed = match.weedIndex ?? null;
  const total = [grass, tree, weed].filter((v) => typeof v === 'number').reduce((a: number, b: number) => a + (b as number), 0);
  return { lat, lon, date: match.date, grass, tree, weed, total, source: 'google' };
}

export type GoogleLookupResult = GooglePollenDay;
