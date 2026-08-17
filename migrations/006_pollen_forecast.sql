CREATE TABLE IF NOT EXISTS pollen_forecast_hourly (
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
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city_slug, ts)
);

CREATE INDEX IF NOT EXISTS idx_forecast_city_ts ON pollen_forecast_hourly(city_slug, ts);
