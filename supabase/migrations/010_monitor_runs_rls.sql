-- Lock down monitor_runs: the server reads/writes via service role (which
-- bypasses RLS). Enabling RLS with no policies blocks all public/anon access,
-- resolving the Supabase security warning about a table exposed to the
-- public API.
ALTER TABLE monitor_runs ENABLE ROW LEVEL SECURITY;
