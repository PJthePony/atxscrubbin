-- Add tipping support to bookings

ALTER TABLE bookings
  ADD COLUMN tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN tip_stripe_payment_intent_id TEXT;
