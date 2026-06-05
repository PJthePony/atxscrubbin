-- Soft-delete for bookings so accidental deletions can be restored.

ALTER TABLE bookings ADD COLUMN deleted_at TIMESTAMPTZ;

-- Most queries only ever want live bookings; index the common case.
CREATE INDEX idx_bookings_active ON bookings(scheduled_date) WHERE deleted_at IS NULL;
