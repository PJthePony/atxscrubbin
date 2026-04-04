import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";
import { google, calendar_v3 } from "googleapis";

export const dynamic = "force-dynamic";

const TIMEZONE = "America/Chicago";

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

const COLOR = {
  availability: "8",   // Graphite
  confirmed: "6",      // Tangerine
  in_progress: "4",    // Flamingo
  completed: "10",     // Basil
} as const;

function getBackfillCalendar(): { cal: calendar_v3.Calendar; calendarId: string } | null {
  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;

  if (!clientEmail || !privateKey) return null;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  return {
    cal: google.calendar({ version: "v3", auth }),
    calendarId: process.env.GOOGLE_CALENDAR_ID || "keepaustinscrubbin@gmail.com",
  };
}

export async function POST() {
  return withAdmin(async () => {
    const supabase = createServerClient();
    const results = { availability: { synced: 0, failed: 0, found: 0 }, bookings: { synced: 0, failed: 0, found: 0 } };

    const client = getBackfillCalendar();
    if (!client) {
      return NextResponse.json({ success: false, error: "Google Calendar credentials not configured" });
    }

    const { cal, calendarId } = client;

    // --- Sync availability overrides ---
    const { data: overrides } = await supabase
      .from("availability_overrides")
      .select("id, team_member_id, date, start_time, end_time, google_calendar_event_id")
      .eq("available", true);

    const { data: members } = await supabase
      .from("team_members")
      .select("id, display_name");

    const memberMap = Object.fromEntries((members || []).map((m) => [m.id, m.display_name]));
    results.availability.found = (overrides || []).length;

    for (const override of overrides || []) {
      try {
        const event: calendar_v3.Schema$Event = {
          summary: `${memberMap[override.team_member_id] || "Team Member"} Available`,
          description: "Team member available for bookings",
          start: { dateTime: `${override.date}T${normalizeTime(override.start_time || "11:00")}`, timeZone: TIMEZONE },
          end: { dateTime: `${override.date}T${normalizeTime(override.end_time || "16:00")}`, timeZone: TIMEZONE },
          colorId: COLOR.availability,
        };

        let eventId: string | null = null;

        if (override.google_calendar_event_id) {
          try {
            const res = await cal.events.update({
              calendarId,
              eventId: override.google_calendar_event_id,
              requestBody: event,
            });
            eventId = res.data.id || override.google_calendar_event_id;
          } catch {
            // Event may have been deleted — create a new one
            const res = await cal.events.insert({ calendarId, requestBody: event });
            eventId = res.data.id || null;
          }
        } else {
          const res = await cal.events.insert({ calendarId, requestBody: event });
          eventId = res.data.id || null;
        }

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
        }
      } catch {
        results.availability.failed++;
      }
    }

    // --- Sync bookings ---
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*, customer:customers(full_name), car_size:car_sizes(name), booking_addons(addon:addons(name))")
      .not("status", "in", '("cancelled","refunded")');

    results.bookings.found = (bookings || []).length;

    for (const booking of bookings || []) {
      try {
        const customer = booking.customer as unknown as { full_name: string } | null;
        const carSize = booking.car_size as unknown as { name: string } | null;
        const addonNames = ((booking.booking_addons || []) as unknown as { addon: { name: string } }[])
          .map((ba) => ba.addon?.name)
          .filter(Boolean);

        const customerName = customer?.full_name || "Unknown";
        const carSizeName = carSize?.name || "Car Wash";

        const lines: string[] = [
          `Customer: ${customerName}`,
          `Service: ${carSizeName}`,
        ];
        if (addonNames.length > 0) lines.push(`Add-ons: ${addonNames.join(", ")}`);
        if (booking.total !== undefined) lines.push(`Total: $${Number(booking.total).toFixed(2)}`);
        if (booking.notes) lines.push(`Notes: ${booking.notes}`);
        lines.push(`Status: ${booking.status}`);

        const event: calendar_v3.Schema$Event = {
          summary: `${customerName} — ${carSizeName}`,
          description: lines.join("\n"),
          location: booking.address,
          start: { dateTime: `${booking.scheduled_date}T${normalizeTime(booking.scheduled_start)}`, timeZone: TIMEZONE },
          end: { dateTime: `${booking.scheduled_date}T${normalizeTime(booking.scheduled_end)}`, timeZone: TIMEZONE },
          colorId: COLOR[booking.status as keyof typeof COLOR] || COLOR.confirmed,
        };

        let eventId: string | null = null;

        if (booking.google_calendar_event_id) {
          try {
            const res = await cal.events.update({
              calendarId,
              eventId: booking.google_calendar_event_id,
              requestBody: event,
            });
            eventId = res.data.id || booking.google_calendar_event_id;
          } catch {
            const res = await cal.events.insert({ calendarId, requestBody: event });
            eventId = res.data.id || null;
          }
        } else {
          const res = await cal.events.insert({ calendarId, requestBody: event });
          eventId = res.data.id || null;
        }

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
        }
      } catch {
        results.bookings.failed++;
      }
    }

    return NextResponse.json({ success: true, results });
  });
}
