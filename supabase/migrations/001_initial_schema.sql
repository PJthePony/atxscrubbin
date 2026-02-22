-- ATX Scrubbin' — Initial Database Schema

-- ============================================
-- Enums
-- ============================================

CREATE TYPE team_member_role AS ENUM ('admin', 'member');
CREATE TYPE booking_status AS ENUM ('confirmed', 'in_progress', 'completed', 'cancelled', 'refunded');

-- ============================================
-- Tables
-- ============================================

-- Team members (Carter, Augie, etc.)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  google_calendar_id TEXT,
  role team_member_role NOT NULL DEFAULT 'member',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer profiles
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  lat DECIMAL,
  lng DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Car size tiers
CREATE TABLE car_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_price DECIMAL(10,2) NOT NULL,
  wash_time_minutes INTEGER NOT NULL DEFAULT 45,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add-on services
CREATE TABLE addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  time_minutes INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  car_size_id UUID NOT NULL REFERENCES car_sizes(id) ON DELETE RESTRICT,
  scheduled_date DATE NOT NULL,
  scheduled_start TIME NOT NULL,
  scheduled_end TIME NOT NULL,
  estimated_duration_minutes INTEGER NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL,
  lng DECIMAL,
  notes TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  reminder_day_before_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_hour_before_sent BOOLEAN NOT NULL DEFAULT false,
  completion_notification_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add-ons attached to a booking (snapshot pricing)
CREATE TABLE booking_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE RESTRICT,
  price_at_booking DECIMAL(10,2) NOT NULL,
  time_at_booking INTEGER NOT NULL DEFAULT 0
);

-- Team members assigned to a booking
CREATE TABLE booking_team_members (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (booking_id, team_member_id)
);

-- Recurring weekly availability per team member
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '10:00',
  end_time TIME NOT NULL DEFAULT '16:00',
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (team_member_id, day_of_week)
);

-- Date-specific availability overrides
CREATE TABLE availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  UNIQUE (team_member_id, date)
);

-- Service area polygon
CREATE TABLE service_area (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polygon JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Key-value settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_bookings_date ON bookings(scheduled_date);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_booking_addons_booking ON booking_addons(booking_id);
CREATE INDEX idx_availability_member ON availability(team_member_id);
CREATE INDEX idx_availability_overrides_member_date ON availability_overrides(team_member_id, date);

-- ============================================
-- Updated-at triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_car_sizes_updated_at
  BEFORE UPDATE ON car_sizes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_addons_updated_at
  BEFORE UPDATE ON addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_service_area_updated_at
  BEFORE UPDATE ON service_area
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Seed data
-- ============================================

-- Default car sizes
INSERT INTO car_sizes (name, description, base_price, wash_time_minutes, sort_order) VALUES
  ('Small', 'Sedans, coupes, compact cars', 40.00, 45, 1),
  ('Medium', 'SUVs, crossovers, wagons', 55.00, 55, 2),
  ('Large', 'Trucks, full-size SUVs, vans', 70.00, 65, 3);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('travel_buffer_minutes', '15'),
  ('default_start_time', '"10:00"'),
  ('default_end_time', '"16:00"'),
  ('min_team_members_per_booking', '2'),
  ('slot_increment_minutes', '30');

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;

-- Customers can read/update their own profile
CREATE POLICY customers_self_select ON customers
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY customers_self_update ON customers
  FOR UPDATE USING (auth.uid() = id);

-- Customers can read their own bookings
CREATE POLICY bookings_customer_select ON bookings
  FOR SELECT USING (auth.uid() = customer_id);

-- Customers can read add-ons for their own bookings
CREATE POLICY booking_addons_customer_select ON booking_addons
  FOR SELECT USING (
    booking_id IN (SELECT id FROM bookings WHERE customer_id = auth.uid())
  );

-- Public read access for car sizes and addons (needed for booking flow)
ALTER TABLE car_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY car_sizes_public_read ON car_sizes
  FOR SELECT USING (true);

ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY addons_public_read ON addons
  FOR SELECT USING (true);

-- Public read access for service area (needed for address validation)
ALTER TABLE service_area ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_area_public_read ON service_area
  FOR SELECT USING (true);
