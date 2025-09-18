import { Pool, defaults, type QueryResult, type QueryResultRow } from 'pg';
// Relax TLS verification for Supabase pooled endpoints which can report self-signed chains
try {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '';
  if (/supabase\.(co|com)/.test(url)) {
    defaults.ssl = { rejectUnauthorized: false } as any;
  }
} catch {}

export type PollenReading = {
  city: string;
  date: string; // YYYY-MM-DD
  count: number;
  source?: string | null;
  is_forecast?: boolean | null;
};

let connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '';
// Force no-verify on SSL in serverless to avoid chain issues
try {
  if (connectionString) {
    if (/sslmode=/.test(connectionString)) {
      connectionString = connectionString.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
    } else {
      connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=no-verify';
    }
  }
  // As a last resort for some environments
  (process.env as any).NODE_TLS_REJECT_UNAUTHORIZED = '0';
} catch {}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false, require: true } });

async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<QueryResult<T>> {
  const res = await pool.query<T>(text, params);
  return res;
}

export async function ensureSchema() {
  await q(`
    CREATE TABLE IF NOT EXISTS pollen_readings (
      city_slug text NOT NULL,
      city_name text,
      lat double precision,
      lon double precision,
      date date NOT NULL,
      source text NOT NULL,
      grass integer,
      tree integer,
      weed integer,
      total integer,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (city_slug, date, source)
    );
  `);
  await q(`
    CREATE TABLE IF NOT EXISTS pollen_plants (
      city_slug text NOT NULL,
      city_name text,
      lat double precision,
      lon double precision,
      date date NOT NULL,
      plant_code text,
      plant_name text,
      plant_type text,
      in_season boolean,
      pollen_index integer,
      pollen_category text,
      family text,
      season text,
      data_source text DEFAULT 'google',
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (city_slug, date, plant_code, data_source)
    );
  `);
  await q(`
    CREATE TABLE IF NOT EXISTS ingest_logs (
      id bigserial PRIMARY KEY,
      ts timestamptz DEFAULT now(),
      job text,
      status text,
      details jsonb
    );
  `);
}

export async function upsertPollenReading(row: {
  city_slug: string;
  city_name?: string;
  lat?: number;
  lon?: number;
  date: string; // YYYY-MM-DD
  source: 'ambee' | 'google';
  grass?: number | null;
  tree?: number | null;
  weed?: number | null;
  total?: number | null;
  is_forecast?: boolean;
}) {
  const total = row.total ?? ((row.grass ?? 0) + (row.tree ?? 0) + (row.weed ?? 0));
  await q(
    `INSERT INTO pollen_readings (city_slug, city_name, lat, lon, date, source, grass, tree, weed, total, is_forecast)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (city_slug, date, source)
     DO UPDATE SET city_name = EXCLUDED.city_name,
                   lat = COALESCE(EXCLUDED.lat, pollen_readings.lat),
                   lon = COALESCE(EXCLUDED.lon, pollen_readings.lon),
                   grass = EXCLUDED.grass,
                   tree = EXCLUDED.tree,
                   weed = EXCLUDED.weed,
                   total = EXCLUDED.total,
                   is_forecast = EXCLUDED.is_forecast`,
    [
      row.city_slug,
      row.city_name ?? null,
      row.lat ?? null,
      row.lon ?? null,
      row.date,
      row.source,
      row.grass ?? null,
      row.tree ?? null,
      row.weed ?? null,
      total,
      row.is_forecast ?? (row.source === 'google'),
    ],
  );
}

export async function upsertPollenPlants(
  city: { slug: string; name?: string; lat?: number; lon?: number },
  date: string,
  plants: Array<{
    code?: string | null;
    displayName?: string | null;
    type?: string | null;
    inSeason?: boolean | null;
    index?: number | null;
    category?: string | null;
    family?: string | null;
    season?: string | null;
  }>,
  isForecast: boolean,
) {
  for (const p of plants) {
    const plantCode = p.code ?? p.displayName ?? 'UNKNOWN';
    await q(
      `INSERT INTO pollen_plants (city_slug, city_name, lat, lon, date,
        plant_code, plant_name, plant_type, in_season, pollen_index, pollen_category, family, season, data_source, is_forecast)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'google',$14)
       ON CONFLICT (city_slug, date, plant_code, data_source)
       DO UPDATE SET plant_name = EXCLUDED.plant_name,
                     plant_type = EXCLUDED.plant_type,
                     in_season = EXCLUDED.in_season,
                     pollen_index = EXCLUDED.pollen_index,
                     pollen_category = EXCLUDED.pollen_category,
                     family = EXCLUDED.family,
                     season = EXCLUDED.season,
                     is_forecast = EXCLUDED.is_forecast,
                     city_name = COALESCE(EXCLUDED.city_name, pollen_plants.city_name),
                     lat = COALESCE(EXCLUDED.lat, pollen_plants.lat),
                     lon = COALESCE(EXCLUDED.lon, pollen_plants.lon)`,
      [
        city.slug,
        city.name ?? null,
        city.lat ?? null,
        city.lon ?? null,
        date,
        plantCode,
        p.displayName ?? null,
        p.type ?? null,
        p.inSeason ?? null,
        p.index ?? null,
        p.category ?? null,
        p.family ?? null,
        p.season ?? null,
        isForecast,
      ],
    );
  }
}

export async function logIngest(status: string, details: Record<string, any>) {
  try {
    const json = JSON.stringify(details);
    await q(`INSERT INTO ingest_logs (job, status, details) VALUES ('ingest', $1, $2::jsonb)`, [
      status,
      json,
    ]);
  } catch {}
}

export async function getPollenByDate(date: string): Promise<PollenReading[]> {
  try {
    const { rows } = await q<PollenReading>(
      `WITH ranked AS (
        SELECT city_slug, date,
               COALESCE(total, COALESCE(grass,0)+COALESCE(tree,0)+COALESCE(weed,0)) AS total,
               source,
               is_forecast,
               ROW_NUMBER() OVER (PARTITION BY city_slug, date ORDER BY (source='ambee') DESC) AS rn
        FROM pollen_readings
        WHERE date = $1
      )
      SELECT city_slug AS city, to_char(date, 'YYYY-MM-DD') as date, total as count, source, is_forecast
      FROM ranked WHERE rn = 1
      ORDER BY city_slug ASC`,
      [date],
    );
    return rows as any;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return [
        { city: 'new-york', date, count: 42 },
        { city: 'san-francisco', date, count: 17 },
      ];
    }
    throw err;
  }
}

export async function getPollenByCity(city: string): Promise<PollenReading[]> {
  try {
    const { rows } = await q<PollenReading>(
      `WITH ranked AS (
        SELECT city_slug, date,
               COALESCE(total, COALESCE(grass,0)+COALESCE(tree,0)+COALESCE(weed,0)) AS total,
               source,
               is_forecast,
               ROW_NUMBER() OVER (PARTITION BY city_slug, date ORDER BY (source='ambee') DESC) AS rn
        FROM pollen_readings
        WHERE city_slug = $1
      )
      SELECT city_slug AS city, to_char(date, 'YYYY-MM-DD') as date, total as count, source, is_forecast
      FROM ranked WHERE rn = 1
      ORDER BY date DESC
      LIMIT 365`,
      [city],
    );
    return rows as any;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      const today = new Date();
      const sample = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        return { city, date: d.toISOString().slice(0, 10), count: Math.floor(Math.random() * 80) };
      });
      return sample;
    }
    throw err;
  }
}

export async function getLatestDate(): Promise<string> {
  const { rows } = await q<{ max: string }>(`SELECT to_char(MAX(date), 'YYYY-MM-DD') as max FROM pollen_readings`);
  return rows?.[0]?.max || new Date().toISOString().slice(0, 10);
}

export async function getMapDataByDate(date: string): Promise<Array<{ city: string; lat: number; lon: number; count: number; tree: number | null; grass: number | null; weed: number | null; source: string | null; is_forecast: boolean | null; top_plants?: Array<{ name: string | null; code: string | null; index: number | null; category: string | null }>; series?: Array<{ date: string; tree: number | null; grass: number | null; weed: number | null; is_forecast: boolean | null }> }>> {
  const { rows } = await q(
    `WITH ranked AS (
      SELECT city_slug, date,
             lat, lon,
             COALESCE(total, COALESCE(grass,0)+COALESCE(tree,0)+COALESCE(weed,0)) AS total,
             grass, tree, weed,
             source,
             is_forecast,
             ROW_NUMBER() OVER (PARTITION BY city_slug, date ORDER BY (source='ambee') DESC) AS rn
      FROM pollen_readings
      WHERE date = $1
    )
    SELECT city_slug AS city, lat, lon, total as count, tree, grass, weed, source, is_forecast,
      (
        SELECT json_agg(json_build_object('name', plant_name, 'code', plant_code, 'index', pollen_index, 'category', pollen_category) ORDER BY pollen_index DESC)
        FROM (
          SELECT plant_name, plant_code, pollen_index, pollen_category
          FROM pollen_plants pp
          WHERE pp.city_slug = ranked.city_slug AND pp.date = ranked.date
          ORDER BY pollen_index DESC NULLS LAST
          LIMIT 3
        ) t
      ) AS top_plants,
      (
        SELECT json_agg(json_build_object('date', to_char(d.d,'YYYY-MM-DD'), 'tree', r.tree, 'grass', r.grass, 'weed', r.weed, 'is_forecast', r.is_forecast) ORDER BY d.d)
        FROM (
          SELECT ($1::date) AS d
          UNION ALL SELECT (($1::date + INTERVAL '1 day')::date)
          UNION ALL SELECT (($1::date + INTERVAL '2 day')::date)
        ) d
        LEFT JOIN (
          SELECT date, tree, grass, weed, is_forecast,
                 ROW_NUMBER() OVER (PARTITION BY date ORDER BY (source='ambee') DESC, is_forecast ASC) rn
          FROM pollen_readings pr
          WHERE pr.city_slug = ranked.city_slug
        ) r ON r.date = d.d AND r.rn = 1
      ) AS series
    FROM ranked WHERE rn = 1
    ORDER BY city_slug ASC`,
    [date],
  );
  return rows as any;
}

export async function getCityTypeSeries(city: string, days: number): Promise<Array<{ date: string; grass: number | null; tree: number | null; weed: number | null; total: number | null; source: string | null; is_forecast: boolean | null }>> {
  const { rows } = await q(
    `WITH ranked AS (
      SELECT city_slug, date,
             grass, tree, weed, total,
             source, is_forecast,
             ROW_NUMBER() OVER (PARTITION BY city_slug, date ORDER BY (source='ambee') DESC) AS rn
      FROM pollen_readings
      WHERE city_slug = $1
    )
    SELECT to_char(date, 'YYYY-MM-DD') as date,
           grass, tree, weed, total, source, is_forecast
    FROM ranked WHERE rn = 1
    ORDER BY date DESC
    LIMIT $2`,
    [city, days],
  );
  return rows as any;
}

export async function getCityForecastTable(city: string, days: number): Promise<Array<{ date: string; actual: number | null; forecast_tomorrow: number | null; forecast_day_after: number | null }>> {
  const { rows } = await q(
    `WITH dates AS (
       SELECT DISTINCT date FROM pollen_readings WHERE city_slug = $1 ORDER BY date DESC LIMIT $2
     ),
     actuals AS (
       SELECT date,
              COALESCE(total, COALESCE(grass,0)+COALESCE(tree,0)+COALESCE(weed,0)) AS total
       FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY date ORDER BY (source='ambee') DESC, NOT is_forecast DESC) rn
         FROM pollen_readings WHERE city_slug = $1
       ) r WHERE rn = 1 AND (is_forecast IS FALSE OR is_forecast = false)
     ),
     forecasts AS (
       SELECT date,
              COALESCE(total, COALESCE(grass,0)+COALESCE(tree,0)+COALESCE(weed,0)) AS total
       FROM pollen_readings WHERE city_slug = $1 AND is_forecast = true AND source = 'google'
     )
     SELECT to_char(d.date, 'YYYY-MM-DD') as date,
            a.total as actual,
            f1.total as forecast_tomorrow,
            f2.total as forecast_day_after
     FROM dates d
     LEFT JOIN actuals a ON a.date = d.date
     LEFT JOIN forecasts f1 ON f1.date = (d.date + INTERVAL '1 day')::date
     LEFT JOIN forecasts f2 ON f2.date = (d.date + INTERVAL '2 day')::date
     ORDER BY d.date DESC`,
    [city, days],
  );
  return rows as any;
}

export async function getCityPlantBreakdown(city: string, days: number): Promise<Array<{ date: string; plant_code: string | null; plant_name: string | null; plant_type: string | null; pollen_index: number | null; pollen_category: string | null; in_season: boolean | null; is_forecast: boolean | null }>> {
  const { rows } = await q(
    `SELECT to_char(date, 'YYYY-MM-DD') as date,
            plant_code, plant_name, plant_type,
            pollen_index, pollen_category, in_season, is_forecast
     FROM pollen_plants
     WHERE city_slug = $1
     ORDER BY date DESC, pollen_index DESC NULLS LAST
     LIMIT $2`,
    [city, days * 12],
  );
  return rows as any;
}

export async function getCityTypeMatrix(city: string, days: number): Promise<Array<{
  date: string;
  day0: { tree: number | null; grass: number | null; weed: number | null };
  day1: { tree: number | null; grass: number | null; weed: number | null };
  day2: { tree: number | null; grass: number | null; weed: number | null };
}>> {
  const { rows } = await q(
    `WITH dates AS (
       SELECT DISTINCT date FROM pollen_readings WHERE city_slug = $1 ORDER BY date DESC LIMIT $2
     ),
     day0 AS (
       SELECT date,
              tree, grass, weed
       FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY date ORDER BY (source='ambee') DESC, (is_forecast IS FALSE) DESC) rn
         FROM pollen_readings WHERE city_slug = $1 AND (is_forecast IS FALSE OR is_forecast IS NULL)
       ) r WHERE rn = 1
     ),
     fcasts AS (
       SELECT date, tree, grass, weed
       FROM pollen_readings WHERE city_slug = $1 AND is_forecast = true AND source = 'google'
     )
     SELECT to_char(d.date, 'YYYY-MM-DD') as date,
            json_build_object('tree', d0.tree, 'grass', d0.grass, 'weed', d0.weed) as day0,
            json_build_object('tree', f1.tree, 'grass', f1.grass, 'weed', f1.weed) as day1,
            json_build_object('tree', f2.tree, 'grass', f2.grass, 'weed', f2.weed) as day2
     FROM dates d
     LEFT JOIN day0 d0 ON d0.date = d.date
     LEFT JOIN fcasts f1 ON f1.date = (d.date + INTERVAL '1 day')::date
     LEFT JOIN fcasts f2 ON f2.date = (d.date + INTERVAL '2 day')::date
     ORDER BY d.date DESC`,
    [city, days],
  );
  return rows as any;
}

export async function getAvailableDates(limit: number = 180): Promise<string[]> {
  const { rows } = await q<{ d: string }>(
    `SELECT to_char(date, 'YYYY-MM-DD') as d
     FROM pollen_readings
     GROUP BY date
     ORDER BY date DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.d);
}
