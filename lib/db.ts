import { sql } from '@vercel/postgres';

export type PollenReading = {
  city: string;
  date: string; // YYYY-MM-DD
  count: number;
};

export async function ensureSchema() {
  await sql`
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
  `;
  await sql`
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
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ingest_logs (
      id bigserial PRIMARY KEY,
      ts timestamptz DEFAULT now(),
      job text,
      status text,
      details jsonb
    );
  `;
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
}) {
  const total =
    row.total ??
    ((row.grass ?? 0) + (row.tree ?? 0) + (row.weed ?? 0));
  await sql`
    INSERT INTO pollen_readings (city_slug, city_name, lat, lon, date, source, grass, tree, weed, total)
    VALUES (${row.city_slug}, ${row.city_name ?? null}, ${row.lat ?? null}, ${row.lon ?? null}, ${row.date}, ${row.source},
            ${row.grass ?? null}, ${row.tree ?? null}, ${row.weed ?? null}, ${total})
    ON CONFLICT (city_slug, date, source)
    DO UPDATE SET city_name = EXCLUDED.city_name,
                  lat = COALESCE(EXCLUDED.lat, pollen_readings.lat),
                  lon = COALESCE(EXCLUDED.lon, pollen_readings.lon),
                  grass = EXCLUDED.grass,
                  tree = EXCLUDED.tree,
                  weed = EXCLUDED.weed,
                  total = EXCLUDED.total;
  `;
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
) {
  for (const p of plants) {
    const plantCode = p.code ?? p.displayName ?? 'UNKNOWN';
    await sql`
      INSERT INTO pollen_plants (city_slug, city_name, lat, lon, date,
        plant_code, plant_name, plant_type, in_season, pollen_index, pollen_category, family, season, data_source)
      VALUES (${city.slug}, ${city.name ?? null}, ${city.lat ?? null}, ${city.lon ?? null}, ${date},
        ${plantCode}, ${p.displayName ?? null}, ${p.type ?? null}, ${p.inSeason ?? null}, ${p.index ?? null}, ${p.category ?? null}, ${p.family ?? null}, ${p.season ?? null}, 'google')
      ON CONFLICT (city_slug, date, plant_code, data_source)
      DO UPDATE SET plant_name = EXCLUDED.plant_name,
                    plant_type = EXCLUDED.plant_type,
                    in_season = EXCLUDED.in_season,
                    pollen_index = EXCLUDED.pollen_index,
                    pollen_category = EXCLUDED.pollen_category,
                    family = EXCLUDED.family,
                    season = EXCLUDED.season,
                    city_name = COALESCE(EXCLUDED.city_name, pollen_plants.city_name),
                    lat = COALESCE(EXCLUDED.lat, pollen_plants.lat),
                    lon = COALESCE(EXCLUDED.lon, pollen_plants.lon);
    `;
  }
}

export async function logIngest(status: string, details: Record<string, any>) {
  try {
    await sql`INSERT INTO ingest_logs (job, status, details) VALUES ('ingest', ${status}, ${details}::jsonb)`;
  } catch {}
}

export async function getPollenByDate(date: string): Promise<PollenReading[]> {
  try {
    const { rows } = await sql<PollenReading>`
      WITH ranked AS (
        SELECT city_slug, date, COALESCE(total, COALESCE(grass,0)+COALESCE(tree,0)+COALESCE(weed,0)) AS total,
               source,
               ROW_NUMBER() OVER (PARTITION BY city_slug, date ORDER BY (source='ambee') DESC) AS rn
        FROM pollen_readings
        WHERE date = ${date}
      )
      SELECT city_slug AS city, to_char(date, 'YYYY-MM-DD') as date, total as count
      FROM ranked WHERE rn = 1
      ORDER BY city_slug ASC
    `;
    return rows;
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
    const { rows } = await sql<PollenReading>`
      WITH ranked AS (
        SELECT city_slug, date, COALESCE(total, COALESCE(grass,0)+COALESCE(tree,0)+COALESCE(weed,0)) AS total,
               source,
               ROW_NUMBER() OVER (PARTITION BY city_slug, date ORDER BY (source='ambee') DESC) AS rn
        FROM pollen_readings
        WHERE city_slug = ${city}
      )
      SELECT city_slug AS city, to_char(date, 'YYYY-MM-DD') as date, total as count
      FROM ranked WHERE rn = 1
      ORDER BY date DESC
      LIMIT 365
    `;
    return rows;
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
