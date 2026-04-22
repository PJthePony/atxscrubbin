-- Log every execution of /api/cron/monitor so the admin panel can show
-- "monitor ran, no issues" without relying on the absence of an email.
CREATE TABLE IF NOT EXISTS monitor_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  findings_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER,
  error TEXT
);

CREATE INDEX IF NOT EXISTS monitor_runs_ran_at_idx ON monitor_runs (ran_at DESC);
