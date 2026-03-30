-- Add Google Calendar event ID tracking to availability overrides and bookings
ALTER TABLE availability_overrides ADD COLUMN google_calendar_event_id TEXT;
ALTER TABLE bookings ADD COLUMN google_calendar_event_id TEXT;
