import { fetchWithRetry } from '@/lib/http';
import { parseUtcDate } from '@/lib/date';

const DAY_SUMMARY_BASE = 'https://api.openweathermap.org/data/3.0/onecall/day_summary';
const AIR_BASE = 'https://api.openweathermap.org/data/2.5/air_pollution/history';

function toUnix(dateISO: string): number {
  return Math.floor((parseUtcDate(dateISO)?.getTime() ?? Number.NaN) / 1000);
}

export function utcDatesInWindow(fromISO: string, toISO: string): string[] {
  const from = parseUtcDate(fromISO);
  const to = parseUtcDate(toISO);
  if (!from || !to || from >= to) return [];

  const dates: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (cursor < to) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export type DailyWeather = {
  date: string; // YYYY-MM-DD UTC
  tz?: string | null;
  temp_min_c?: number | null;
  temp_max_c?: number | null;
  temp_day_c?: number | null;
  feels_like_day_c?: number | null;
  humidity?: number | null;
  pressure_hpa?: number | null;
  wind_speed_ms?: number | null;
  wind_deg?: number | null;
  clouds_pct?: number | null;
  precip_mm?: number | null;
  uvi?: number | null;
  weather_main?: string | null;
  weather_desc?: string | null;
  aqi?: number | null; // 1..5
  aqi_pm2_5?: number | null;
  aqi_pm10?: number | null;
  aqi_o3?: number | null;
  aqi_no2?: number | null;
  aqi_so2?: number | null;
  aqi_co?: number | null;
};

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function fetchDailySummary(
  lat: number,
  lon: number,
  date: string,
  onProviderCall?: () => void,
): Promise<DailyWeather> {
  const key = process.env.OPENWEATHER_API_KEY || '';
  const url = `${DAY_SUMMARY_BASE}?lat=${lat}&lon=${lon}&date=${encodeURIComponent(date)}&units=metric&appid=${encodeURIComponent(key)}`;
  onProviderCall?.();
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenWeather daily summary failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const temperature = json?.temperature || {};
  const feelsLike = json?.feels_like || {};
  const humidity = json?.humidity || {};
  const pressure = json?.pressure || {};
  const wind = json?.wind || {};
  const precipitation = json?.precipitation || {};

  return {
    date: typeof json?.date === 'string' ? json.date : date,
    tz: typeof json?.tz === 'string'
      ? json.tz
      : typeof json?.timezone === 'string'
        ? json.timezone
        : null,
    temp_min_c: numeric(temperature.min),
    temp_max_c: numeric(temperature.max),
    temp_day_c: numeric(temperature.afternoon),
    feels_like_day_c: numeric(feelsLike.afternoon),
    humidity: numeric(humidity.afternoon),
    pressure_hpa: numeric(pressure.afternoon),
    wind_speed_ms: numeric(wind?.max?.speed) ?? numeric(wind?.afternoon?.speed),
    wind_deg: numeric(wind?.max?.direction) ?? numeric(wind?.afternoon?.direction),
    clouds_pct: numeric(json?.cloud_cover?.afternoon),
    precip_mm: numeric(precipitation.total),
  };
}

export async function fetchAirHistory(
  lat: number,
  lon: number,
  fromISO: string,
  toISO: string,
  onProviderCall?: () => void,
): Promise<Array<{ ts: number, aqi: number, comps: any }>> {
  const key = process.env.OPENWEATHER_API_KEY || '';
  const start = toUnix(fromISO);
  const end = toUnix(toISO);
  const url = `${AIR_BASE}?lat=${lat}&lon=${lon}&start=${start}&end=${end}&appid=${encodeURIComponent(key)}`;
  onProviderCall?.();
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenWeather Air History failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const list = Array.isArray(json.list) ? json.list : [];
  return list.map((e: any) => ({
    ts: e.dt,
    aqi: Number(e.main?.aqi ?? null) || null,
    comps: e.components || {},
  }));
}

export async function openweatherDailyWithAqi(
  lat: number,
  lon: number,
  fromISO: string,
  toISO: string,
  onProviderCall?: () => void,
): Promise<Record<string, DailyWeather>> {
  const dates = utcDatesInWindow(fromISO, toISO);
  const summaries = await Promise.all(
    dates.map((date) => fetchDailySummary(lat, lon, date, onProviderCall)),
  );
  const byDate: Record<string, DailyWeather> = {};
  for (const summary of summaries) byDate[summary.date] = summary;

  // Air history on the requested window; aggregate per day
  const air = await fetchAirHistory(lat, lon, fromISO, toISO, onProviderCall);
  const airByDate = new Map<string, { aqiSum: number; aqiCount: number; comps: Record<string, number[]> }>();
  for (const a of air) {
    const date = new Date(a.ts * 1000).toISOString().slice(0, 10);
    const cur = airByDate.get(date) || { aqiSum: 0, aqiCount: 0, comps: {} };
    if (a.aqi != null) {
      cur.aqiSum += a.aqi;
      cur.aqiCount += 1;
    }
    for (const [k, v] of Object.entries(a.comps || {})) {
      const arr = cur.comps[k] || [];
      if (typeof v === 'number') arr.push(v as number);
      cur.comps[k] = arr;
    }
    airByDate.set(date, cur);
  }

  for (const [date, agg] of airByDate.entries()) {
    const avg = (vals: number[]) => (vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : null);
    const target = byDate[date] || { date } as DailyWeather;
    target.aqi = agg.aqiCount ? Math.round(agg.aqiSum / agg.aqiCount) : null;
    target.aqi_pm2_5 = avg(agg.comps['pm2_5'] || []);
    target.aqi_pm10 = avg(agg.comps['pm10'] || []);
    target.aqi_o3 = avg(agg.comps['o3'] || []);
    target.aqi_no2 = avg(agg.comps['no2'] || []);
    target.aqi_so2 = avg(agg.comps['so2'] || []);
    target.aqi_co = avg(agg.comps['co'] || []);
    byDate[date] = target;
  }

  // Clamp to the UTC dates touched by the requested window.
  const requestedDates = new Set(dates);
  const out: Record<string, DailyWeather> = {};
  for (const [d, v] of Object.entries(byDate)) {
    if (requestedDates.has(d)) out[d] = v;
  }
  return out;
}

