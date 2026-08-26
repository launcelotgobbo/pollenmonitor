-- Close the gap where tables added after 002/004 shipped without row level
-- security while Supabase's default grants still gave anon/authenticated full
-- read/write access over PostgREST.
--
-- The app connects as the table owner (BYPASSRLS), so enabling and forcing RLS
-- here does not affect the site's own queries or ingestion.

DO $$
DECLARE
  app_table text;
  blocked_role text;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'pollen_readings_hourly',
    'weather_daily',
    'pollen_forecast_hourly',
    'ingest_logs',
    'ambee_usage_logs'
  ]
  LOOP
    CONTINUE WHEN to_regclass('public.' || app_table) IS NULL;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', app_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', app_table);

    -- This app never reads through Supabase's client-facing PostgREST roles.
    -- Remove the permissive policies created by 002/004 so operational logs
    -- are not exposed to arbitrary authenticated Supabase users.
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', app_table || '_select_auth', app_table);

    -- RLS does not cover TRUNCATE and grants remain dangerous if RLS is ever
    -- disabled, so remove every table privilege from client-facing roles.
    FOR blocked_role IN
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON %I FROM %I',
        app_table,
        blocked_role
      );
    END LOOP;
  END LOOP;
END
$$;
