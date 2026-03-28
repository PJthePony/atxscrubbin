import { createServerClient } from "@/lib/supabase";

interface SlotResult {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

interface OverrideRow {
  team_member_id: string;
  start_time: string | null;
  end_time: string | null;
}

interface BookingRow {
  scheduled_start: string;
  scheduled_end: string;
}

// Fixed availability window when a team member is marked available
const WINDOW_START = "11:00";
const WINDOW_END = "16:00";

/**
 * Get available time slots for a given date and wash duration.
 * A date is bookable when at least min_team_members_per_booking team members
 * have explicitly marked themselves available for that date.
 */
export async function getAvailableSlots(
  date: string, // "YYYY-MM-DD"
  durationMinutes: number
): Promise<SlotResult[]> {
  const supabase = createServerClient();

  // 1. Load settings
  const { data: settingsRows } = await supabase
    .from("settings")
    .select("key, value");

  const settings: Record<string, string> = {};
  for (const row of settingsRows || []) {
    settings[row.key] =
      typeof row.value === "string" ? row.value : JSON.stringify(row.value);
  }

  const travelBuffer = parseInt(settings.travel_buffer_minutes || "10", 10);
  const slotIncrement = parseInt(settings.slot_increment_minutes || "30", 10);
  const minTeam = parseInt(settings.min_team_members_per_booking || "2", 10);

  // 2. Get active team members
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id")
    .eq("active", true);

  if (!teamMembers || teamMembers.length < minTeam) {
    return [];
  }

  const memberIds = teamMembers.map((m) => m.id);

  // 3. Get team members who have marked themselves available for this date
  const { data: availableRows } = await supabase
    .from("availability_overrides")
    .select("team_member_id, start_time, end_time")
    .eq("date", date)
    .eq("available", true)
    .in("team_member_id", memberIds);

  if (!availableRows || availableRows.length < minTeam) {
    return [];
  }

  // 4. Build per-member availability windows
  const memberWindows: Map<string, { start: string; end: string }[]> =
    new Map();

  for (const row of availableRows as OverrideRow[]) {
    memberWindows.set(row.team_member_id, [
      {
        start: row.start_time?.substring(0, 5) || WINDOW_START,
        end: row.end_time?.substring(0, 5) || WINDOW_END,
      },
    ]);
  }

  if (memberWindows.size < minTeam) {
    return [];
  }

  // 5. Get existing bookings for this date
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("scheduled_start, scheduled_end")
    .eq("scheduled_date", date)
    .not("status", "in", '("cancelled","refunded")');

  const bookings = (bookingRows as BookingRow[] | null) || [];

  // 6. Generate candidate slots within the availability window
  // Each slot needs travelBuffer on both sides (before and after the wash)
  const slots: SlotResult[] = [];

  let cursor = timeToMinutes(WINDOW_START);
  const endLimit = timeToMinutes(WINDOW_END);

  while (cursor + durationMinutes <= endLimit) {
    const slotStart = minutesToTime(cursor);
    const slotEnd = minutesToTime(cursor + durationMinutes);

    // Count members available and not already booked for this slot
    let availableCount = 0;
    for (const [, windows] of memberWindows) {
      const memberAvailable = windows.some(
        (w) => w.start <= slotStart && w.end >= slotEnd
      );

      if (memberAvailable) {
        // Check if this slot (with travel buffer on both sides) overlaps
        // with any existing booking (also with travel buffer on both sides)
        const memberBusy = bookings.some((b) => {
          const bStartMin = timeToMinutes(b.scheduled_start.substring(0, 5));
          const bEndMin = timeToMinutes(b.scheduled_end.substring(0, 5));
          const slotStartMin = cursor;
          const slotEndMin = cursor + durationMinutes;
          // Overlap check: new slot needs buffer after, existing booking needs buffer before/after
          return (
            slotStartMin < bEndMin + travelBuffer &&
            slotEndMin + travelBuffer > bStartMin
          );
        });

        if (!memberBusy) {
          availableCount++;
        }
      }
    }

    if (availableCount >= minTeam) {
      slots.push({ start: slotStart, end: slotEnd });
    }

    cursor += slotIncrement;
  }

  return slots;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
