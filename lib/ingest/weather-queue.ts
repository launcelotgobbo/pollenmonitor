import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { parseUtcDate } from '@/lib/date';
import type { City } from '@/lib/ingest/cities';

export type WeatherTask = {
  id: string;
  city: City;
  fromISO: string;
  toISO: string;
  leaseToken: string;
};

export async function enqueueWeather(cities: City[], fromISO: string, toISO: string) {
  const from = parseUtcDate(fromISO);
  const to = parseUtcDate(toISO);
  if (!from || !to || from >= to) throw new Error('Invalid weather task window');
  await query(
    `INSERT INTO weather_ingest_tasks (city_slug, city, from_ts, to_ts, run_date)
     SELECT city->>'slug', city, $2::timestamptz, $3::timestamptz,
            ($3::timestamptz AT TIME ZONE 'UTC')::date
     FROM jsonb_array_elements($1::jsonb) AS city
     ON CONFLICT (run_date, city_slug) DO NOTHING`,
    [JSON.stringify(cities), from.toISOString(), to.toISOString()],
  );
}

export async function claimWeatherTask(): Promise<WeatherTask | null> {
  const leaseToken = randomUUID();
  const { rows } = await query<{ id: string; city: City; from_ts: Date; to_ts: Date }>(
    `WITH candidate AS (
       SELECT id FROM weather_ingest_tasks
       WHERE status <> 'complete' AND available_at <= now()
         AND (lease_until IS NULL OR lease_until < now())
       ORDER BY attempts, to_ts DESC, id
       FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE weather_ingest_tasks t
     SET status = 'running', attempts = attempts + 1, lease_token = $1,
         lease_until = now() + interval '6 minutes', updated_at = now()
     FROM candidate c WHERE t.id = c.id
     RETURNING t.id::text, t.city, t.from_ts, t.to_ts`,
    [leaseToken],
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        city: row.city,
        fromISO: row.from_ts.toISOString(),
        toISO: row.to_ts.toISOString(),
        leaseToken,
      }
    : null;
}

export async function finishWeatherTask(
  task: WeatherTask,
  complete: boolean,
  failure: 'timeout' | 'quota' | 'provider' = 'provider',
) {
  const result = await query(
    `UPDATE weather_ingest_tasks
     SET status = $3, last_failure = $4, lease_token = NULL, lease_until = NULL, updated_at = now(),
         available_at = now() + make_interval(mins => LEAST(360, 30 * attempts))
     WHERE id = $1::bigint AND lease_token = $2`,
    [task.id, task.leaseToken, complete ? 'complete' : 'pending', complete ? null : failure],
  );
  if (result.rowCount !== 1) throw new Error('Weather task lease lost');
}

export async function pendingWeatherTasks() {
  const { rows } = await query<{ count: string }>(
    `SELECT count(*)::text FROM weather_ingest_tasks WHERE status <> 'complete'`,
  );
  return Number(rows[0].count);
}
