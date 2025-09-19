-- Enable row level security on hourly readings and ingest logs

DO $$
BEGIN
  IF to_regclass('public.pollen_readings_hourly') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE pollen_readings_hourly ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE pollen_readings_hourly FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pollen_readings_hourly_select_auth ON pollen_readings_hourly';
    EXECUTE 'CREATE POLICY pollen_readings_hourly_select_auth ON pollen_readings_hourly FOR SELECT TO authenticated, service_role USING (true)';
  END IF;

  IF to_regclass('public.ingest_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ingest_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE ingest_logs FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ingest_logs_select_auth ON ingest_logs';
    EXECUTE 'CREATE POLICY ingest_logs_select_auth ON ingest_logs FOR SELECT TO authenticated, service_role USING (true)';
  END IF;
END
$$;
