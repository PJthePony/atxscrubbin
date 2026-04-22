-- Add 'pending' to booking_status for bookings that have been created but
-- not yet paid. The Stripe webhook flips 'pending' -> 'confirmed' once
-- payment is confirmed. Cleanup is now safe because 'pending' unambiguously
-- means "unpaid", not "webhook hasn't fired yet".
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'confirmed';
