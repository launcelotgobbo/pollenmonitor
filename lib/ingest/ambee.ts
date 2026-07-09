import { fetchWithRetry } from '@/lib/http';

const AMBEE_BASE = 'https://api.ambeedata.com';

function headers() {
  const key = process.env.AMBEE_API_KEY;
  return {
    'Content-Type': 'application/json',
    'x-api-key': key || '',
  } as Record<string, string>;
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
  // Pollen API v3 (https://docs-pollen-v3.ambeedata.com/); history covers at most the past 48 hours
  const url = `${AMBEE_BASE}/v3/pollen/history?lat=${lat}&lng=${lon}&from=${enc(fromISO)}&to=${enc(toISO)}&locale=true`;
  const res = await fetchWithRetry(url, { headers: headers(), cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ambee hourly range failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  const responseTz = typeof json?.timezone === 'string' ? json.timezone : null;
  return list.map((hour: any) => {
    const ts =
      hour?.timestamp ||
      (hour?.unixTs ? new Date(hour.unixTs * 1000).toISOString() : null) ||
      hour?.createdAt ||
      (hour?.time ? new Date(hour.time * 1000).toISOString() : null);
    const tz = hour?.timezone || responseTz;
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
