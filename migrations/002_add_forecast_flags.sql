-- Add forecast flags to distinguish forecast vs actuals

ALTER TABLE IF EXISTS pollen_readings
  ADD COLUMN IF NOT EXISTS is_forecast boolean DEFAULT false;

ALTER TABLE IF EXISTS pollen_plants
  ADD COLUMN IF NOT EXISTS is_forecast boolean DEFAULT false;

