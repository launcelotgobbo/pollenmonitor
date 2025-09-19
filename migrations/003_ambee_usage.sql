CREATE TABLE IF NOT EXISTS ambee_usage_logs (
  id bigserial PRIMARY KEY,
  ts timestamptz DEFAULT now(),
  job text NOT NULL,
  job_id text,
  ambee_calls integer NOT NULL,
  notes jsonb
);

CREATE INDEX IF NOT EXISTS idx_ambee_usage_logs_ts ON ambee_usage_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_ambee_usage_logs_job ON ambee_usage_logs(job);
