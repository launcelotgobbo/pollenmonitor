import { fetchWithRetry } from '@/lib/http';
import { parseUtcDate } from '@/lib/date';

// One Call 3.0 is deprecated and can no longer be subscribed to; the 4.0 daily
// timeline is the replacement for `day_summary` and covers history and
// forecast from one endpoint.
const DAILY_TIMELINE_BASE = 'https://api.openweathermap.org/data/4.0/onecall/timeline/1day';
const AIR_BASE = 'https://api.openweathermap.org/data/2.5/air_pollution/history';

// Documented page size for the 1-day timeline.
const DAILY_TIMELINE_PAGE_DAYS = 10;
const DAILY_TIMELINE_MAX_PAGES = 4;

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

// Historical timeline days carry whole-number pressure/humidity/wind/cloud
// values, but the current and forecast days are averaged from hourly data and
// arrive fractional (e.g. pressure 1015.52). Those columns are integers.
function integer(value: unknown): number | null {
  const parsed = numeric(value);
  return parsed === null ? null : Math.round(parsed);
}

export class OpenWeatherSummaryError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`OpenWeather daily summary failed (${status}): ${body}`);
    this.name = 'OpenWeatherSummaryError';
  }

  // 401/403 mean the key or One Call subscription is the problem, so every
  // other city in the run would fail the same way.
  get affectsAllCities() {
    return this.status === 401 || this.status === 403;
  }
}

// Daily precipitation arrives as a plain mm volume, but the 4.0 docs also list
// the hourly `{ "1h": mm }` shape, so accept both.
function precipVolume(value: unknown): number | null {
  if (typeof value === 'number') return numeric(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return numeric(record['1h']) ?? numeric(record.total);
  }
  return null;
}

function mapTimelineRecord(record: any, timezone: string | null): DailyWeather | null {
  const dt = numeric(record?.dt);
  if (dt === null) return null;
  const temp = record?.temp || {};
  const feelsLike = record?.feels_like || {};
  const weather = Array.isArray(record?.weather) ? record.weather[0] : null;
  const rain = precipVolume(record?.rain);
  const snow = precipVolume(record?.snow);

  return {
    // Daily records are stamped at local noon, so the UTC date of `dt` is the
    // local calendar day for every timezone within ±11 hours of UTC.
    date: new Date(dt * 1000).toISOString().slice(0, 10),
    tz: timezone,
    temp_min_c: numeric(temp.min),
    temp_max_c: numeric(temp.max),
    temp_day_c: numeric(temp.day),
    feels_like_day_c: numeric(feelsLike.day),
    humidity: integer(record?.humidity),
    pressure_hpa: integer(record?.pressure),
    wind_speed_ms: numeric(record?.wind_speed),
    wind_deg: integer(record?.wind_deg),
    clouds_pct: integer(record?.clouds),
    precip_mm: rain === null && snow === null ? null : (rain ?? 0) + (snow ?? 0),
    uvi: numeric(record?.uvi),
    weather_main: typeof weather?.main === 'string' ? weather.main : null,
    weather_desc: typeof weather?.description === 'string' ? weather.description : null,
  };
}

async function fetchTimelinePage(url: string, onProviderCall?: () => void) {
  const res = await fetchWithRetry(url, undefined, { onAttempt: onProviderCall });
  if (!res.ok) {
    throw new OpenWeatherSummaryError(res.status, await res.text());
  }
  return res.json();
}

/**
 * Fetch daily weather for the given UTC dates (sorted ascending). One request
 * covers up to ten consecutive days, so a normal ingest window costs a single
 * call per city.
 */
export async function fetchDailyTimeline(
  lat: number,
  lon: number,
  dates: string[],
  onProviderCall?: () => void,
): Promise<Record<string, DailyWeather>> {
  const byDate: Record<string, DailyWeather> = {};
  if (dates.length === 0) return byDate;

  const wanted = new Set(dates);
  const lastWanted = dates[dates.length - 1];
  const key = process.env.OPENWEATHER_API_KEY || '';
  // Start a day early: the first record returned is the local day containing
  // `start`, which for western timezones is the day before the UTC date.
  const start = toUnix(dates[0]) - 86_400;
  let url: string | null =
    `${DAILY_TIMELINE_BASE}?lat=${lat}&lon=${lon}&start=${start}&units=metric&appid=${encodeURIComponent(key)}`;

  for (let page = 0; url && page < DAILY_TIMELINE_MAX_PAGES; page++) {
    const json = await fetchTimelinePage(url, onProviderCall);
    const timezone = typeof json?.timezone === 'string' ? json.timezone : null;
    const records = Array.isArray(json?.data) ? json.data : [];
    let latestSeen: string | null = null;
    for (const record of records) {
      const day = mapTimelineRecord(record, timezone);
      if (!day) continue;
      if (wanted.has(day.date)) byDate[day.date] = day;
      if (!latestSeen || day.date > latestSeen) latestSeen = day.date;
    }
    const covered = latestSeen !== null && latestSeen >= lastWanted;
    url =
      !covered && records.length >= DAILY_TIMELINE_PAGE_DAYS && typeof json?.next === 'string'
        ? json.next
        : null;
  }
  return byDate;
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
  const res = await fetchWithRetry(url, undefined, { onAttempt: onProviderCall });
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

export type OpenWeatherDailyResult = {
  byDate: Record<string, DailyWeather>;
  // First daily-summary failure, if any. AQI rows are still returned so a
  // broken One Call subscription does not also drop the free air-quality data.
  summaryError: OpenWeatherSummaryError | Error | null;
};

export async function openweatherDailyWithAqi(
  lat: number,
  lon: number,
  fromISO: string,
  toISO: string,
  onProviderCall?: () => void,
  { includeSummary = true }: { includeSummary?: boolean } = {},
): Promise<OpenWeatherDailyResult> {
  const dates = utcDatesInWindow(fromISO, toISO);
  const byDate: Record<string, DailyWeather> = {};
  let summaryError: OpenWeatherSummaryError | Error | null = null;

  if (includeSummary) {
    try {
      Object.assign(byDate, await fetchDailyTimeline(lat, lon, dates, onProviderCall));
    } catch (error) {
      summaryError = error instanceof Error ? error : new Error(String(error));
    }
  }

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
  return { byDate: out, summaryError };
}

