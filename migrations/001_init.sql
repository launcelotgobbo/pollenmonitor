-- Schema initialization for pollenmonitor

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

CREATE TABLE IF NOT EXISTS ingest_logs (
  id bigserial PRIMARY KEY,
  ts timestamptz DEFAULT now(),
  job text,
  status text,
  details jsonb
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_pollen_readings_date ON pollen_readings(date);
CREATE INDEX IF NOT EXISTS idx_pollen_readings_city ON pollen_readings(city_slug);
CREATE INDEX IF NOT EXISTS idx_pollen_plants_city_date ON pollen_plants(city_slug, date);

