-- One row per city per UTC day, aggregated from pollen_readings_hourly.
-- Daily readers (city history, map, matrix, pollen-range aggregate=day,
-- available dates) used to fold 24 hourly rows per city-day on every request.
-- The ingest job refreshes the days it touched (refreshPollenDaily in
-- lib/pollen-daily.ts); scripts/backfill-pollen-daily.ts fills history.
CREATE TABLE IF NOT EXISTS pollen_daily (
  city_slug text NOT NULL,
  date date NOT NULL,
  tz text,
  readings integer NOT NULL,
  tree integer,
  grass integer,
  weed integer,
  total integer,
  peak_tree integer,
  peak_grass integer,
  peak_weed integer,
  peak_total integer,
  species jsonb,
  peak_species jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city_slug, date)
);

CREATE INDEX IF NOT EXISTS idx_pollen_daily_date ON pollen_daily(date);

-- Same posture as 007: the app connects as the owner (BYPASSRLS); Supabase's
-- client-facing roles get nothing.
ALTER TABLE pollen_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE pollen_daily FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  blocked_role text;
BEGIN
  FOR blocked_role IN
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON pollen_daily FROM %I', blocked_role);
  END LOOP;
END
$$;
