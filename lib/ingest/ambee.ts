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

export async function ambeeRange(
  lat: number,
  lon: number,
  fromISO: string,
  toISO: string,
): Promise<ProviderReading[]> {
  if (!process.env.AMBEE_API_KEY || process.env.USE_MOCK_DATA === 'true') {
    const start = new Date(fromISO);
    const end = new Date(toISO);
    const out: ProviderReading[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      out.push({
        lat,
        lon,
        date: ds,
        total: Math.floor(Math.random() * 80) + 10,
        grass: Math.floor(Math.random() * 30),
        tree: Math.floor(Math.random() * 30),
        weed: Math.floor(Math.random() * 30),
        source: 'ambee',
      });
    }
    return out;
  }
  const enc = (s: string) => encodeURIComponent(s);
  const url = `${AMBEE_BASE}/history/pollen/by-lat-lng?lat=${lat}&lng=${lon}&from=${enc(fromISO)}&to=${enc(toISO)}`;
  const res = await fetch(url, { headers: headers(), cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  return list
    .map((hour: any) => {
      const ts = hour?.createdAt || (hour?.time ? new Date(hour.time * 1000).toISOString() : null);
      const risk = hour?.Risk || hour?.risk || {};
      const cnt = hour?.Count || hour?.count || {};
      const species = hour?.Species || hour?.species || {};
      const grass = cnt?.grass_pollen ?? null;
      const tree = cnt?.tree_pollen ?? null;
      const weed = cnt?.weed_pollen ?? null;
      const total = (grass ?? 0) + (tree ?? 0) + (weed ?? 0);
      return {
        lat,
        lon,
        date: ts ? ts.slice(0, 10) : fromISO.slice(0, 10),
        grass,
        tree,
        weed,
        total,
        source: 'ambee',
      } as ProviderReading;
    })
    .filter(Boolean);
}

export type AmbeeHourly = {
  ts: string;
  tz?: string | null;
  grass?: number | null;
  tree?: number | null;
  weed?: number | null;
  risk_grass?: string | null;
  risk_tree?: string | null;
  risk_weed?: string | null;
  species?: any;
};

export async function ambeeHourlyRange(
  lat: number,
  lon: number,
  fromISO: string,
  toISO: string,
): Promise<AmbeeHourly[]> {
  if (!process.env.AMBEE_API_KEY || process.env.USE_MOCK_DATA === 'true') {
    const out: AmbeeHourly[] = [];
    const start = new Date(fromISO);
    const end = new Date(toISO);
    for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
      out.push({
        ts: d.toISOString(),
        tz: 'UTC',
        grass: Math.floor(Math.random() * 20),
        tree: Math.floor(Math.random() * 20),
        weed: Math.floor(Math.random() * 40),
        risk_grass: 'Low',
        risk_tree: 'Low',
        risk_weed: 'Moderate',
        species: { Weed: { Ragweed: Math.floor(Math.random() * 40) } },
      });
    }
    return out;
  }
  const enc = (s: string) => encodeURIComponent(s);
  const url = `${AMBEE_BASE}/history/pollen/by-lat-lng?lat=${lat}&lng=${lon}&from=${enc(fromISO)}&to=${enc(toISO)}`;
  const res = await fetch(url, { headers: headers(), cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  return list.map((hour: any) => {
    const ts = hour?.createdAt || (hour?.time ? new Date(hour.time * 1000).toISOString() : null);
    const tz = hour?.timezone || null;
    const risk = hour?.Risk || {};
    const cnt = hour?.Count || {};
    const species = hour?.Species || null;
    return {
      ts: ts || new Date().toISOString(),
      tz,
      grass: cnt?.grass_pollen ?? null,
      tree: cnt?.tree_pollen ?? null,
      weed: cnt?.weed_pollen ?? null,
      risk_grass: risk?.grass_pollen ?? null,
      risk_tree: risk?.tree_pollen ?? null,
      risk_weed: risk?.weed_pollen ?? null,
      species,
    } as AmbeeHourly;
  });
}
