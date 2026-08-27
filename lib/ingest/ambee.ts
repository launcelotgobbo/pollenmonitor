import { fetchWithRetry, type RetryOptions } from '@/lib/http';
import { withNabRisk } from '@/lib/risk';
import type { SpeciesBreakdown } from '@/lib/species';

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
  species?: SpeciesBreakdown | null;
};

function isMockMode() {
  return !process.env.AMBEE_API_KEY || process.env.USE_MOCK_DATA === 'true';
}

function mockHourly(fromISO: string, toISO: string): AmbeeHourly[] {
  const out: AmbeeHourly[] = [];
  const start = new Date(fromISO);
  const end = new Date(toISO);
  for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
    const row = {
      ts: d.toISOString(),
      tz: 'UTC',
      grass: Math.floor(Math.random() * 20),
      tree: Math.floor(Math.random() * 20),
      weed: Math.floor(Math.random() * 40),
      species: { Weed: { Ragweed: Math.floor(Math.random() * 40) } },
    };
    out.push(withNabRisk(row));
  }
  return out;
}

function mapPollenItem(hour: any, responseTz: string | null): AmbeeHourly {
  const ts =
    hour?.timestamp ||
    (hour?.unixTs ? new Date(hour.unixTs * 1000).toISOString() : null) ||
    hour?.createdAt ||
    (hour?.time ? new Date(hour.time * 1000).toISOString() : null);
  const cnt = hour?.Count || {};
  return withNabRisk({
    ts: ts || new Date().toISOString(),
    tz: hour?.timezone || responseTz,
    grass: cnt?.grass_pollen ?? null,
    tree: cnt?.tree_pollen ?? null,
    weed: cnt?.weed_pollen ?? null,
    species: hour?.Species ?? null,
  });
}

async function fetchPollenList(
  url: string,
  label: string,
  retryOptions?: RetryOptions,
): Promise<AmbeeHourly[]> {
  const res = await fetchWithRetry(
    url,
    { headers: headers(), cache: 'no-store' },
    retryOptions,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${label} failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  const responseTz = typeof json?.timezone === 'string' ? json.timezone : null;
  return list.map((hour: any) => mapPollenItem(hour, responseTz));
}

export async function ambeeHourlyRange(
  lat: number,
  lon: number,
  fromISO: string,
  toISO: string,
): Promise<AmbeeHourly[]> {
  if (isMockMode()) return mockHourly(fromISO, toISO);
  const enc = (s: string) => encodeURIComponent(s);
  // Pollen API v3 (https://docs-pollen-v3.ambeedata.com/); history covers at most the past 48 hours
  const url = `${AMBEE_BASE}/v3/pollen/history?lat=${lat}&lng=${lon}&from=${enc(fromISO)}&to=${enc(toISO)}&locale=true`;
  return fetchPollenList(url, 'Ambee hourly range');
}

export async function ambeeForecast48h(
  lat: number,
  lon: number,
  retryOptions?: RetryOptions,
): Promise<AmbeeHourly[]> {
  if (isMockMode()) {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now);
    end.setHours(end.getHours() + 47);
    return mockHourly(now.toISOString(), end.toISOString());
  }
  const url = `${AMBEE_BASE}/v3/pollen/forecast/48hrs?lat=${lat}&lng=${lon}&locale=true`;
  return fetchPollenList(url, 'Ambee 48h forecast', retryOptions);
}
