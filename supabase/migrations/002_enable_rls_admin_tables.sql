-- Enable RLS on admin-only tables
-- These tables are only accessed via service role key (which bypasses RLS),
-- so enabling RLS with no anon policies effectively blocks direct client access.

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Public read access for settings (needed by booking slot calculation via API,
-- but all current access uses service role key so this is optional —
-- adding it defensively in case a future client-side query needs it)
-- If you want these fully locked down, remove this policy.
-- CREATE POLICY settings_public_read ON settings FOR SELECT USING (true);
