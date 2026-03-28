// ---- Enums ----

export type TeamMemberRole = "admin" | "member";

export type BookingStatus =
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "refunded";

// ---- Database Row Types ----

export interface TeamMember {
  id: string;
  username: string;
  display_name: string;
  phone: string;
  email: string;
  google_calendar_id: string | null;
  role: TeamMemberRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sms_opt_in: boolean;
  sms_confirmed: boolean;
  email_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface CarSize {
  id: string;
  name: string;
  description: string;
  base_price: number;
  wash_time_minutes: number;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
  time_minutes: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  car_size_id: string;
  scheduled_date: string;
  scheduled_start: string;
  scheduled_end: string;
  estimated_duration_minutes: number;
  address: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  subtotal: number;
  total: number;
  status: BookingStatus;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  tip_amount: number;
  tip_stripe_payment_intent_id: string | null;
  reminder_day_before_sent: boolean;
  reminder_hour_before_sent: boolean;
  completion_notification_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingAddon {
  id: string;
  booking_id: string;
  addon_id: string;
  price_at_booking: number;
  time_at_booking: number;
}

export interface BookingTeamMember {
  booking_id: string;
  team_member_id: string;
}

export interface Availability {
  id: string;
  team_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

export interface AvailabilityOverride {
  id: string;
  team_member_id: string;
  date: string;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface ServiceArea {
  id: string;
  polygon: { type: "Polygon"; coordinates: number[][][] };
  updated_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

// ---- Joined / Expanded Types ----

export interface BookingWithDetails extends Booking {
  customer: Customer;
  car_size: CarSize;
  addons: (BookingAddon & { addon: Addon })[];
  team_members: (BookingTeamMember & { team_member: TeamMember })[];
}

// ---- API / Form Types ----

export interface TimeSlot {
  start: string;
  end: string;
}

export interface BookingFormData {
  car_size_id: string;
  addon_ids: string[];
  address: string;
  lat: number;
  lng: number;
  scheduled_date: string;
  scheduled_start: string;
  phone: string;
  notes: string;
}
