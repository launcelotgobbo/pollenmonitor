import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  OpenWeatherSummaryError,
  fetchDailyTimeline,
  openweatherDailyWithAqi,
  utcDatesInWindow,
} from '@/lib/weather/openweather';

const DAY1 = Date.UTC(2026, 6, 7, 12) / 1000; // 2026-07-07T12:00Z
const DAY2 = Date.UTC(2026, 6, 8, 12) / 1000; // 2026-07-08T12:00Z
const DAY3 = Date.UTC(2026, 6, 9, 12) / 1000; // 2026-07-09T12:00Z (outside window)

// Daily records are stamped at local noon; Denver is UTC-6 in July.
const localNoon = (utcNoon: number) => utcNoon + 6 * 3600;

function dailyRecord(dt: number, overrides: Record<string, unknown> = {}) {
  return {
    dt,
    temp: { day: 24.3, min: 12.5, max: 28.1, night: 15, eve: 22, morn: 13 },
    feels_like: { day: 23.9, night: 14.5, eve: 21.5, morn: 12.8 },
    pressure: 1015,
    humidity: 40,
    wind_speed: 3.2,
    wind_deg: 180,
    clouds: 20,
    pop: 0.2,
    uvi: 7.1,
    rain: 1.4,
    weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
    ...overrides,
  };
}

const timelineResponse = {
  lat: 39.74,
  lon: -104.99,
  timezone: 'America/Denver',
  timezone_offset: -21600,
  data: [
    dailyRecord(localNoon(DAY1) - 86_400, { temp: { min: 1, max: 2, day: 1.5 } }),
    dailyRecord(localNoon(DAY1)),
    dailyRecord(localNoon(DAY2), {
      temp: { day: 26, min: 14, max: 30 },
      feels_like: { day: 25.5 },
      humidity: 35,
      pressure: 1012,
      wind_speed: 4.5,
      wind_deg: 210,
      clouds: 5,
      uvi: 9,
      rain: undefined,
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
    }),
    dailyRecord(localNoon(DAY3)),
  ],
};

const airResponse = {
  list: [
    { dt: DAY1 - 3600, main: { aqi: 2 }, components: { pm2_5: 10, pm10: 20, o3: 60 } },
    { dt: DAY1, main: { aqi: 4 }, components: { pm2_5: 30, pm10: 40, o3: 80 } },
    { dt: DAY2, main: { aqi: 1 }, components: { pm2_5: 5, pm10: 8, o3: 50 } },
  ],
};

type Stub = (url: URL) => Response | null;

async function withStubbedFetch<T>(
  fn: () => Promise<T>,
  stub: Stub = () => null,
): Promise<{ result: T; urls: string[] }> {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENWEATHER_API_KEY;
  process.env.OPENWEATHER_API_KEY = 'ow-key';
  const urls: string[] = [];
  globalThis.fetch = (async (input: any) => {
    const url = new URL(String(input));
    urls.push(url.toString());
    const custom = stub(url);
    if (custom) return custom;
    if (url.pathname === '/data/4.0/onecall/timeline/1day') {
      return new Response(JSON.stringify(timelineResponse), { status: 200 });
    }
    if (url.pathname === '/data/2.5/air_pollution/history') {
      return new Response(JSON.stringify(airResponse), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  try {
    const result = await fn();
    return { result, urls };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENWEATHER_API_KEY;
    else process.env.OPENWEATHER_API_KEY = originalKey;
  }
}

test('fetchDailyTimeline requests the 4.0 daily timeline once and maps the records', async () => {
  const calls: number[] = [];
  const { result, urls } = await withStubbedFetch(() =>
    fetchDailyTimeline(39.74, -104.99, ['2026-07-07', '2026-07-08'], () => calls.push(1)),
  );

  assert.equal(urls.length, 1);
  assert.equal(calls.length, 1);
  const url = new URL(urls[0]);
  assert.equal(url.host, 'api.openweathermap.org');
  assert.equal(url.pathname, '/data/4.0/onecall/timeline/1day');
  assert.equal(url.searchParams.get('lat'), '39.74');
  assert.equal(url.searchParams.get('lon'), '-104.99');
  assert.equal(url.searchParams.get('units'), 'metric');
  assert.equal(url.searchParams.get('appid'), 'ow-key');
  assert.equal(url.searchParams.get('start'), String(Date.UTC(2026, 6, 6) / 1000));

  assert.deepEqual(Object.keys(result).sort(), ['2026-07-07', '2026-07-08']);
  const day1 = result['2026-07-07'];
  assert.equal(day1.tz, 'America/Denver');
  assert.equal(day1.temp_min_c, 12.5);
  assert.equal(day1.temp_max_c, 28.1);
  assert.equal(day1.temp_day_c, 24.3);
  assert.equal(day1.feels_like_day_c, 23.9);
  assert.equal(day1.humidity, 40);
  assert.equal(day1.pressure_hpa, 1015);
  assert.equal(day1.wind_speed_ms, 3.2);
  assert.equal(day1.wind_deg, 180);
  assert.equal(day1.clouds_pct, 20);
  assert.equal(day1.precip_mm, 1.4);
  assert.equal(day1.uvi, 7.1);
  assert.equal(day1.weather_main, 'Rain');
  assert.equal(day1.weather_desc, 'light rain');

  const day2 = result['2026-07-08'];
  assert.equal(day2.temp_max_c, 30);
  assert.equal(day2.precip_mm, null, 'no rain or snow field means unknown, not zero');
  assert.equal(day2.weather_main, 'Clear');
});

test('fetchDailyTimeline sums rain and snow and accepts the hourly-style volume object', async () => {
  const { result } = await withStubbedFetch(
    () => fetchDailyTimeline(39.74, -104.99, ['2026-07-07']),
    () =>
      new Response(
        JSON.stringify({
          timezone: 'America/Denver',
          data: [dailyRecord(localNoon(DAY1), { rain: { '1h': 2.5 }, snow: 1 })],
        }),
        { status: 200 },
      ),
  );
  assert.equal(result['2026-07-07'].precip_mm, 3.5);
});

test('fetchDailyTimeline follows next pages only until the requested dates are covered', async () => {
  const pageOneDays = Array.from({ length: 10 }, (_, i) => dailyRecord(localNoon(DAY1) + i * 86_400));
  const pageTwoDays = Array.from({ length: 10 }, (_, i) =>
    dailyRecord(localNoon(DAY1) + (10 + i) * 86_400, { uvi: 1 }),
  );
  const { result, urls } = await withStubbedFetch(
    () => fetchDailyTimeline(39.74, -104.99, ['2026-07-07', '2026-07-18']),
    (url) => {
      const page = url.searchParams.get('page');
      const body = page === '2'
        ? { timezone: 'America/Denver', data: pageTwoDays }
        : {
            timezone: 'America/Denver',
            data: pageOneDays,
            next: 'https://api.openweathermap.org/data/4.0/onecall/timeline/1day?page=2&appid=ow-key',
          };
      return new Response(JSON.stringify(body), { status: 200 });
    },
  );
  assert.equal(urls.length, 2);
  assert.equal(result['2026-07-07'].uvi, 7.1);
  assert.equal(result['2026-07-18'].uvi, 1);

  const { urls: singlePage } = await withStubbedFetch(
    () => fetchDailyTimeline(39.74, -104.99, ['2026-07-07', '2026-07-08']),
    () =>
      new Response(
        JSON.stringify({
          timezone: 'America/Denver',
          data: pageOneDays,
          next: 'https://api.openweathermap.org/data/4.0/onecall/timeline/1day?page=2&appid=ow-key',
        }),
        { status: 200 },
      ),
  );
  assert.equal(singlePage.length, 1, 'no extra page once the last requested date is present');
});

test('fetchDailyTimeline counts every HTTP attempt toward the provider quota', async () => {
  let attempts = 0;
  let served = 0;
  await withStubbedFetch(
    () => fetchDailyTimeline(39.74, -104.99, ['2026-07-07'], () => attempts++),
    () => (served++ === 0 ? new Response('busy', { status: 503 }) : null),
  );
  assert.equal(served, 2);
  assert.equal(attempts, 2);
});

test('openweatherDailyWithAqi merges daily weather with per-day AQI averages', async () => {
  const {
    result: { byDate, summaryError },
    urls,
  } = await withStubbedFetch(() =>
    openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-09T00:00:00Z'),
  );

  assert.equal(urls.length, 2, 'one timeline call plus one air-history call');
  assert.equal(summaryError, null);

  const day1 = byDate['2026-07-07'];
  assert.ok(day1);
  assert.equal(day1.tz, 'America/Denver');
  assert.equal(day1.temp_min_c, 12.5);
  assert.equal(day1.temp_max_c, 28.1);
  assert.equal(day1.temp_day_c, 24.3);
  assert.equal(day1.humidity, 40);
  assert.equal(day1.precip_mm, 1.4);
  assert.equal(day1.wind_speed_ms, 3.2);
  assert.equal(day1.wind_deg, 180);
  assert.equal(day1.aqi, 3); // round((2 + 4) / 2)
  assert.equal(day1.aqi_pm2_5, 20); // avg(10, 30)
  assert.equal(day1.aqi_pm10, 30);
  assert.equal(day1.aqi_o3, 70);

  const day2 = byDate['2026-07-08'];
  assert.ok(day2);
  assert.equal(day2.temp_max_c, 30);
  assert.equal(day2.aqi, 1);
  assert.equal(day2.aqi_pm2_5, 5);
});

test('openweatherDailyWithAqi keeps only the UTC dates touched by the requested window', async () => {
  const {
    result: { byDate },
  } = await withStubbedFetch(() =>
    openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-09T00:00:00Z'),
  );

  assert.deepEqual(Object.keys(byDate).sort(), ['2026-07-07', '2026-07-08']);
  assert.equal(byDate['2026-07-06'], undefined);
  assert.equal(byDate['2026-07-09'], undefined);
});

test('utcDatesInWindow excludes an exact midnight upper bound', () => {
  assert.deepEqual(
    utcDatesInWindow('2026-07-07T12:00:00Z', '2026-07-09T00:00:00Z'),
    ['2026-07-07', '2026-07-08'],
  );
  assert.deepEqual(utcDatesInWindow('invalid', '2026-07-09T00:00:00Z'), []);
});

test('utcDatesInWindow treats zone-less job timestamps as UTC regardless of local timezone', () => {
  assert.deepEqual(
    utcDatesInWindow('2026-08-25 23:30:00', '2026-08-26 01:30:00'),
    ['2026-08-25', '2026-08-26'],
  );
});

function summaryFailure(status: number): Stub {
  return (url) =>
    url.pathname.includes('/onecall/timeline/1day')
      ? new Response(
          `{"cod":${status},"message":"Please note that using One Call requires a separate subscription"}`,
          { status },
        )
      : null;
}

test('openweatherDailyWithAqi keeps AQI rows and reports the daily summary failure', async () => {
  const {
    result: { byDate, summaryError },
  } = await withStubbedFetch(
    () => openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-09T00:00:00Z'),
    summaryFailure(401),
  );

  assert.ok(summaryError instanceof OpenWeatherSummaryError);
  assert.equal(summaryError.status, 401);
  assert.equal(summaryError.affectsAllCities, true);
  assert.match(summaryError.message, /OpenWeather daily summary failed \(401\)/);

  assert.deepEqual(Object.keys(byDate).sort(), ['2026-07-07', '2026-07-08']);
  assert.equal(byDate['2026-07-07'].aqi, 3);
  assert.equal(byDate['2026-07-07'].temp_max_c, undefined);
  assert.equal(byDate['2026-07-08'].aqi, 1);
});

test('openweatherDailyWithAqi treats a 404 summary failure as city-specific', async () => {
  const {
    result: { summaryError },
  } = await withStubbedFetch(
    () => openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-08T00:00:00Z'),
    summaryFailure(404),
  );
  assert.ok(summaryError instanceof OpenWeatherSummaryError);
  assert.equal(summaryError.affectsAllCities, false);
});

test('openweatherDailyWithAqi can skip the daily summary and still fetch AQI', async () => {
  const {
    result: { byDate, summaryError },
    urls,
  } = await withStubbedFetch(() =>
    openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-09T00:00:00Z', undefined, {
      includeSummary: false,
    }),
  );

  assert.equal(urls.length, 1);
  assert.match(urls[0], /air_pollution\/history/);
  assert.equal(summaryError, null);
  assert.equal(byDate['2026-07-07'].aqi, 3);
});

test('openweatherDailyWithAqi still fails when the air history request fails', async () => {
  await assert.rejects(
    withStubbedFetch(
      () => openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-09T00:00:00Z'),
      () => new Response('invalid key', { status: 401 }),
    ),
    /OpenWeather Air History failed \(401\)/,
  );
});
