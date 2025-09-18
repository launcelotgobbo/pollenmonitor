import { ProviderReading } from './types';

const AMBEE_BASE = 'https://api.ambeedata.com';

function headers() {
  const key = process.env.AMBEE_API_KEY;
  return {
    'Content-Type': 'application/json',
    'x-api-key': key || '',
  } as Record<string, string>;
}

export async function ambeeCurrent(lat: number, lon: number): Promise<ProviderReading | null> {
  if (!process.env.AMBEE_API_KEY || process.env.USE_MOCK_DATA === 'true') {
    return {
      lat,
      lon,
      date: new Date().toISOString().slice(0, 10),
      total: Math.floor(Math.random() * 80) + 10,
      grass: Math.floor(Math.random() * 30),
      tree: Math.floor(Math.random() * 30),
      weed: Math.floor(Math.random() * 30),
      source: 'ambee',
    };
  }
  const url = `${AMBEE_BASE}/latest/pollen/by-lat-lng?lat=${lat}&lng=${lon}`;
  const res = await fetch(url, { headers: headers(), cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json();
  // Shape: json.data ? adapt accordingly if fields differ
  const today = new Date().toISOString().slice(0, 10);
  const grass = json?.data?.risk?.grass?.value ?? null;
  const tree = json?.data?.risk?.tree?.value ?? json?.data?.Risk?.tree?.value ?? null;
  const weed = json?.data?.risk?.weed?.value ?? null;
  const total = json?.data?.risk?.pollen?.value ?? (grass ?? 0) + (tree ?? 0) + (weed ?? 0);
  return { lat, lon, date: today, grass, tree, weed, total, source: 'ambee' };
}

export async function ambeeHistorical(lat: number, lon: number, date: string): Promise<ProviderReading | null> {
  if (!process.env.AMBEE_API_KEY || process.env.USE_MOCK_DATA === 'true') {
    return {
      lat,
      lon,
      date,
      total: Math.floor(Math.random() * 80) + 10,
      grass: Math.floor(Math.random() * 30),
      tree: Math.floor(Math.random() * 30),
      weed: Math.floor(Math.random() * 30),
      source: 'ambee',
    };
  }
  const url = `${AMBEE_BASE}/history/pollen/by-lat-lng?lat=${lat}&lng=${lon}&from=${date}&to=${date}`;
  const res = await fetch(url, { headers: headers(), cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json();
  const day = json?.data?.[0] ?? json?.data ?? null;
  const grass = day?.risk?.grass?.value ?? null;
  const tree = day?.risk?.tree?.value ?? null;
  const weed = day?.risk?.weed?.value ?? null;
  const total = day?.risk?.pollen?.value ?? (grass ?? 0) + (tree ?? 0) + (weed ?? 0);
  return { lat, lon, date, grass, tree, weed, total, source: 'ambee' };
}

