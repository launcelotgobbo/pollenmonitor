DO $$
BEGIN
  IF to_regclass('public.ambee_usage_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ambee_usage_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE ambee_usage_logs FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ambee_usage_logs_select_auth ON ambee_usage_logs';
    EXECUTE 'CREATE POLICY ambee_usage_logs_select_auth ON ambee_usage_logs FOR SELECT TO authenticated, service_role USING (true)';
  END IF;
END
$$;
