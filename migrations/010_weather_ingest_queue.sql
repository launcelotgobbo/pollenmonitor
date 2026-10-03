-- City-sized checkpoints let weather resume without refetching pollen.
CREATE TABLE weather_ingest_tasks (
  id bigserial PRIMARY KEY,
  city_slug text NOT NULL,
  city jsonb NOT NULL,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  run_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token text,
  lease_until timestamptz,
  last_failure text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_ts < to_ts),
  UNIQUE (run_date, city_slug)
);

CREATE INDEX weather_ingest_pending ON weather_ingest_tasks (available_at, to_ts)
  WHERE status <> 'complete';

ALTER TABLE weather_ingest_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_ingest_tasks FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  blocked_role text;
BEGIN
  FOR blocked_role IN
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON weather_ingest_tasks FROM %I', blocked_role);
    EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE weather_ingest_tasks_id_seq FROM %I', blocked_role);
  END LOOP;
END
$$;
