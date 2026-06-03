-- Store the Stripe Checkout Session id on the booking so abandoned-booking
-- cleanup can verify payment with a deterministic GET /checkout/sessions/{id}
-- instead of the Search API. Stripe's Search API does NOT support Checkout
-- Sessions (it 400s) and, even where search is supported, it has indexing lag
-- that can make a freshly-paid booking look unpaid. A direct retrieve has no
-- lag, so we never delete a paid booking by mistake.
ALTER TABLE bookings ADD COLUMN stripe_checkout_session_id TEXT;
