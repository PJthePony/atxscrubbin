import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";
import { syncAvailabilityEvent, syncBookingEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function POST() {
  return withAdmin(async () => {
    const supabase = createServerClient();
    const results = { availability: { synced: 0, failed: 0, found: 0 }, bookings: { synced: 0, failed: 0, found: 0 }, debug: {} as Record<string, unknown> };

    // --- Sync all active availability overrides (create or update, no duplicates) ---
    const { data: overrides, error: overridesError } = await supabase
      .from("availability_overrides")
      .select("id, team_member_id, date, start_time, end_time, google_calendar_event_id")
      .eq("available", true);

    const { data: members } = await supabase
      .from("team_members")
      .select("id, display_name");

    const memberMap = Object.fromEntries((members || []).map((m) => [m.id, m.display_name]));

    results.availability.found = (overrides || []).length;
    results.debug.overridesError = overridesError?.message || null;
    results.debug.membersCount = (members || []).length;

    for (const override of overrides || []) {
      try {
        const eventId = await syncAvailabilityEvent({
          teamMemberName: memberMap[override.team_member_id] || "Team Member",
          date: override.date,
          startTime: override.start_time || "11:00",
          endTime: override.end_time || "16:00",
          existingEventId: override.google_calendar_event_id,
        });

        if (eventId) {
          if (eventId !== override.google_calendar_event_id) {
            await supabase
              .from("availability_overrides")
              .update({ google_calendar_event_id: eventId })
              .eq("id", override.id);
          }
          results.availability.synced++;
        } else {
          results.availability.failed++;
          if (!results.debug.firstAvailError) {
            results.debug.firstAvailError = "syncAvailabilityEvent returned null";
          }
        }
      } catch (err) {
        results.availability.failed++;
        if (!results.debug.firstAvailError) {
          results.debug.firstAvailError = (err as Error).message;
        }
      }
      // Stop after first few to avoid timeout - just need to see if it works
      if (results.availability.synced + results.availability.failed >= 3) break;
    }

    // --- Sync all active bookings (create or update, no duplicates) ---
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("*, customer:customers(full_name), car_size:car_sizes(name), booking_addons(addon:addons(name))")
      .not("status", "in", '("cancelled","refunded")');

    results.bookings.found = (bookings || []).length;
    results.debug.bookingsError = bookingsError?.message || null;

    for (const booking of bookings || []) {
      try {
        const customer = booking.customer as unknown as { full_name: string } | null;
        const carSize = booking.car_size as unknown as { name: string } | null;
        const addonNames = ((booking.booking_addons || []) as unknown as { addon: { name: string } }[])
          .map((ba) => ba.addon?.name)
          .filter(Boolean);

        const eventId = await syncBookingEvent({
          status: booking.status,
          customerName: customer?.full_name || "Unknown",
          carSizeName: carSize?.name || "Car Wash",
          date: booking.scheduled_date,
          startTime: booking.scheduled_start,
          endTime: booking.scheduled_end,
          address: booking.address,
          total: booking.total,
          notes: booking.notes,
          addonNames,
          existingEventId: booking.google_calendar_event_id,
        });

        if (eventId) {
          if (eventId !== booking.google_calendar_event_id) {
            await supabase
              .from("bookings")
              .update({ google_calendar_event_id: eventId })
              .eq("id", booking.id);
          }
          results.bookings.synced++;
        } else {
          results.bookings.failed++;
          if (!results.debug.firstBookingError) {
            results.debug.firstBookingError = "syncBookingEvent returned null";
          }
        }
      } catch (err) {
        results.bookings.failed++;
        if (!results.debug.firstBookingError) {
          results.debug.firstBookingError = (err as Error).message;
        }
      }
      if (results.bookings.synced + results.bookings.failed >= 3) break;
    }

    return NextResponse.json({ success: true, results });
  });
}
