-- Base schema for pollenmonitor (hourly Ambee data only)

CREATE TABLE IF NOT EXISTS pollen_readings_hourly (
  city_slug text NOT NULL,
  ts timestamptz NOT NULL,
  tz text,
  grass integer,
  tree integer,
  weed integer,
  total integer,
  risk_grass text,
  risk_tree text,
  risk_weed text,
  species jsonb,
  source text NOT NULL DEFAULT 'ambee',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (city_slug, ts, source)
);

CREATE TABLE IF NOT EXISTS ingest_logs (
  id bigserial PRIMARY KEY,
  ts timestamptz DEFAULT now(),
  job text,
  status text,
  details jsonb
);

CREATE INDEX IF NOT EXISTS idx_hourly_city_ts ON pollen_readings_hourly(city_slug, ts);
CREATE INDEX IF NOT EXISTS idx_hourly_ts ON pollen_readings_hourly(ts);
