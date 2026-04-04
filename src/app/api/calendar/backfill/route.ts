import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";
import { syncAvailabilityEvent, syncBookingEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function POST() {
  return withAdmin(async () => {
    const supabase = createServerClient();
    const results = { availability: { synced: 0, failed: 0 }, bookings: { synced: 0, failed: 0 } };

    // --- Backfill availability overrides ---
    const { data: overrides } = await supabase
      .from("availability_overrides")
      .select("id, team_member_id, date, start_time, end_time, google_calendar_event_id")
      .eq("available", true)
      .is("google_calendar_event_id", null);

    const { data: members } = await supabase
      .from("team_members")
      .select("id, display_name");

    const memberMap = Object.fromEntries((members || []).map((m) => [m.id, m.display_name]));

    for (const override of overrides || []) {
      try {
        const eventId = await syncAvailabilityEvent({
          teamMemberName: memberMap[override.team_member_id] || "Team Member",
          date: override.date,
          startTime: override.start_time || "11:00",
          endTime: override.end_time || "16:00",
          existingEventId: null,
        });

        if (eventId) {
          await supabase
            .from("availability_overrides")
            .update({ google_calendar_event_id: eventId })
            .eq("id", override.id);
          results.availability.synced++;
        } else {
          results.availability.failed++;
        }
      } catch {
        results.availability.failed++;
      }
    }

    // --- Backfill bookings ---
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*, customer:customers(full_name), car_size:car_sizes(name), booking_addons(addon:addons(name))")
      .not("status", "in", '("cancelled","refunded")')
      .is("google_calendar_event_id", null);

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
          existingEventId: null,
        });

        if (eventId) {
          await supabase
            .from("bookings")
            .update({ google_calendar_event_id: eventId })
            .eq("id", booking.id);
          results.bookings.synced++;
        } else {
          results.bookings.failed++;
        }
      } catch {
        results.bookings.failed++;
      }
    }

    return NextResponse.json({ success: true, results });
  });
}
