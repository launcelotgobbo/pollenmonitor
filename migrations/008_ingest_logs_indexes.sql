-- ingest_logs previously had only its primary key. The operator endpoint and
-- the health check both read the newest rows, optionally filtered by job.
CREATE INDEX IF NOT EXISTS idx_ingest_logs_ts ON ingest_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_logs_job_ts ON ingest_logs(job, ts DESC);
