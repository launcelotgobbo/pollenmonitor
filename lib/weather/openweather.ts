import { fetchWithRetry } from '@/lib/http';

const ONECALL_BASE = 'https://api.openweathermap.org/data/3.0/onecall';
const AIR_BASE = 'https://api.openweathermap.org/data/2.5/air_pollution/history';

function toUnix(dateISO: string): number {
  return Math.floor(new Date(dateISO).getTime() / 1000);
}

function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
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

export async function fetchDaily(lat: number, lon: number) : Promise<{ tz: string | null, days: Array<{ ts: number, data: any }> }> {
  const key = process.env.OPENWEATHER_API_KEY || '';
  const url = `${ONECALL_BASE}?lat=${lat}&lon=${lon}&exclude=hourly,minutely,alerts&units=metric&appid=${encodeURIComponent(key)}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenWeather OneCall failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const tz = typeof json.timezone === 'string' ? json.timezone : null;
  const days = Array.isArray(json.daily) ? json.daily.map((d: any) => ({ ts: d.dt, data: d })) : [];
  return { tz, days };
}

export async function fetchAirHistory(lat: number, lon: number, fromISO: string, toISO: string) : Promise<Array<{ ts: number, aqi: number, comps: any }>> {
  const key = process.env.OPENWEATHER_API_KEY || '';
  const start = toUnix(fromISO);
  const end = toUnix(toISO);
  const url = `${AIR_BASE}?lat=${lat}&lon=${lon}&start=${start}&end=${end}&appid=${encodeURIComponent(key)}`;
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

export async function openweatherDailyWithAqi(lat: number, lon: number, fromISO: string, toISO: string): Promise<Record<string, DailyWeather>> {
  const { tz, days } = await fetchDaily(lat, lon);
  const byDate: Record<string, DailyWeather> = {};
  for (const d of days) {
    const date = new Date(d.ts * 1000).toISOString().slice(0, 10);
    const w = d.data;
    byDate[date] = {
      date,
      tz: tz ?? null,
      temp_min_c: w?.temp?.min ?? null,
      temp_max_c: w?.temp?.max ?? null,
      temp_day_c: w?.temp?.day ?? null,
      feels_like_day_c: w?.feels_like?.day ?? null,
      humidity: w?.humidity ?? null,
      pressure_hpa: w?.pressure ?? null,
      wind_speed_ms: w?.wind_speed ?? null,
      wind_deg: w?.wind_deg ?? null,
      clouds_pct: w?.clouds ?? null,
      precip_mm: typeof w?.rain === 'number' ? w.rain : (typeof w?.snow === 'number' ? w.snow : null),
      uvi: w?.uvi ?? null,
      weather_main: Array.isArray(w?.weather) && w.weather[0]?.main ? String(w.weather[0].main) : null,
      weather_desc: Array.isArray(w?.weather) && w.weather[0]?.description ? String(w.weather[0].description) : null,
    };
  }

  // Air history on the requested window; aggregate per day
  const air = await fetchAirHistory(lat, lon, fromISO, toISO);
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

  // Clamp to requested window
  const fromDate = isoDate(fromISO);
  const toDate = isoDate(toISO);
  const out: Record<string, DailyWeather> = {};
  for (const [d, v] of Object.entries(byDate)) {
    if (d >= fromDate && d < toDate) out[d] = v;
  }
  return out;
}

