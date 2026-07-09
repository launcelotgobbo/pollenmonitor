CREATE TABLE IF NOT EXISTS weather_daily (
  city_slug text NOT NULL,
  date date NOT NULL,
  tz text,
  temp_min_c numeric,
  temp_max_c numeric,
  temp_day_c numeric,
  feels_like_day_c numeric,
  humidity integer,
  pressure_hpa integer,
  wind_speed_ms numeric,
  wind_deg integer,
  clouds_pct integer,
  precip_mm numeric,
  uvi numeric,
  weather_main text,
  weather_desc text,
  aqi integer,
  aqi_pm2_5 numeric,
  aqi_pm10 numeric,
  aqi_o3 numeric,
  aqi_no2 numeric,
  aqi_so2 numeric,
  aqi_co numeric,
  source text NOT NULL DEFAULT 'openweather',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (city_slug, date, source)
);

CREATE INDEX IF NOT EXISTS idx_weather_daily_city_date ON weather_daily(city_slug, date);
CREATE INDEX IF NOT EXISTS idx_weather_daily_date ON weather_daily(date);
