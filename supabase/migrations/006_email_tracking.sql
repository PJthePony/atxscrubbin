-- Add email tracking columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmation_email_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_email_sent BOOLEAN NOT NULL DEFAULT false;
