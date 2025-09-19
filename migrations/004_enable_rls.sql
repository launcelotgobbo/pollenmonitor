-- Enable row level security on core tables and add minimal policies

-- pollen_readings
ALTER TABLE pollen_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pollen_readings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pollen_readings_select_auth ON pollen_readings;
CREATE POLICY pollen_readings_select_auth
  ON pollen_readings
  FOR SELECT
  TO authenticated, service_role
  USING (true);

-- pollen_readings_hourly
ALTER TABLE pollen_readings_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE pollen_readings_hourly FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pollen_readings_hourly_select_auth ON pollen_readings_hourly;
CREATE POLICY pollen_readings_hourly_select_auth
  ON pollen_readings_hourly
  FOR SELECT
  TO authenticated, service_role
  USING (true);

-- pollen_plants
ALTER TABLE pollen_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pollen_plants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pollen_plants_select_auth ON pollen_plants;
CREATE POLICY pollen_plants_select_auth
  ON pollen_plants
  FOR SELECT
  TO authenticated, service_role
  USING (true);

-- ingest_logs (read-only via API)
ALTER TABLE ingest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ingest_logs_select_auth ON ingest_logs;
CREATE POLICY ingest_logs_select_auth
  ON ingest_logs
  FOR SELECT
  TO authenticated, service_role
  USING (true);
