import { strict as assert } from 'node:assert';
import test from 'node:test';
import { openweatherDailyWithAqi } from '@/lib/weather/openweather';

const DAY1 = Date.UTC(2026, 6, 7, 12) / 1000; // 2026-07-07T12:00Z
const DAY2 = Date.UTC(2026, 6, 8, 12) / 1000; // 2026-07-08T12:00Z
const DAY3 = Date.UTC(2026, 6, 9, 12) / 1000; // 2026-07-09T12:00Z (outside window)

const oneCallResponse = {
  timezone: 'America/Denver',
  daily: [
    {
      dt: DAY1,
      temp: { min: 12.5, max: 28.1, day: 24.3 },
      feels_like: { day: 23.9 },
      humidity: 40,
      pressure: 1015,
      wind_speed: 3.2,
      wind_deg: 180,
      clouds: 20,
      rain: 1.4,
      uvi: 8.1,
      weather: [{ main: 'Rain', description: 'light rain' }],
    },
    {
      dt: DAY2,
      temp: { min: 14, max: 30, day: 26 },
      feels_like: { day: 25.5 },
      humidity: 35,
      pressure: 1012,
      wind_speed: 4.5,
      wind_deg: 210,
      clouds: 5,
      uvi: 9,
      weather: [{ main: 'Clear', description: 'clear sky' }],
    },
    {
      dt: DAY3,
      temp: { min: 15, max: 31, day: 27 },
      feels_like: { day: 26.5 },
      humidity: 30,
      pressure: 1010,
      wind_speed: 5,
      wind_deg: 220,
      clouds: 0,
      uvi: 9.5,
      weather: [{ main: 'Clear', description: 'clear sky' }],
    },
  ],
};

const airResponse = {
  list: [
    { dt: DAY1 - 3600, main: { aqi: 2 }, components: { pm2_5: 10, pm10: 20, o3: 60 } },
    { dt: DAY1, main: { aqi: 4 }, components: { pm2_5: 30, pm10: 40, o3: 80 } },
    { dt: DAY2, main: { aqi: 1 }, components: { pm2_5: 5, pm10: 8, o3: 50 } },
  ],
};

async function withStubbedFetch<T>(fn: () => Promise<T>): Promise<{ result: T; urls: string[] }> {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/data/3.0/onecall')) {
      return new Response(JSON.stringify(oneCallResponse), { status: 200 });
    }
    if (url.includes('/air_pollution/history')) {
      return new Response(JSON.stringify(airResponse), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  try {
    const result = await fn();
    return { result, urls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('openweatherDailyWithAqi merges daily weather with per-day AQI averages', async () => {
  const { result: byDate, urls } = await withStubbedFetch(() =>
    openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-09T00:00:00Z'),
  );

  assert.equal(urls.length, 2);

  const day1 = byDate['2026-07-07'];
  assert.ok(day1);
  assert.equal(day1.tz, 'America/Denver');
  assert.equal(day1.temp_min_c, 12.5);
  assert.equal(day1.temp_max_c, 28.1);
  assert.equal(day1.temp_day_c, 24.3);
  assert.equal(day1.humidity, 40);
  assert.equal(day1.precip_mm, 1.4);
  assert.equal(day1.weather_main, 'Rain');
  assert.equal(day1.weather_desc, 'light rain');
  assert.equal(day1.aqi, 3); // round((2 + 4) / 2)
  assert.equal(day1.aqi_pm2_5, 20); // avg(10, 30)
  assert.equal(day1.aqi_pm10, 30);
  assert.equal(day1.aqi_o3, 70);

  const day2 = byDate['2026-07-08'];
  assert.ok(day2);
  assert.equal(day2.weather_main, 'Clear');
  assert.equal(day2.precip_mm, null);
  assert.equal(day2.aqi, 1);
  assert.equal(day2.aqi_pm2_5, 5);
});

test('openweatherDailyWithAqi clamps results to the requested window', async () => {
  const { result: byDate } = await withStubbedFetch(() =>
    openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-09T00:00:00Z'),
  );

  assert.deepEqual(Object.keys(byDate).sort(), ['2026-07-07', '2026-07-08']);
  assert.equal(byDate['2026-07-09'], undefined);
});

test('openweatherDailyWithAqi surfaces OneCall API failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('invalid key', { status: 401 })) as typeof fetch;
  try {
    await assert.rejects(
      openweatherDailyWithAqi(39.74, -104.99, '2026-07-07T00:00:00Z', '2026-07-09T00:00:00Z'),
      /OpenWeather OneCall failed \(401\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
