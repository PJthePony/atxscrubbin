import { createServerClient } from "@/lib/supabase";

interface SlotResult {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

interface AvailabilityRow {
  team_member_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

interface OverrideRow {
  team_member_id: string;
  date: string;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
}

interface BookingRow {
  scheduled_start: string;
  scheduled_end: string;
}

/**
 * Get available time slots for a given date and wash duration.
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
    settings[row.key] = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
  }

  const travelBuffer = parseInt(settings.travel_buffer_minutes || "15", 10);
  const slotIncrement = parseInt(settings.slot_increment_minutes || "30", 10);
  const minTeam = parseInt(settings.min_team_members_per_booking || "2", 10);

  // 2. Determine day of week (0=Sunday, 6=Saturday)
  const dateObj = new Date(date + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  // 3. Get active team members
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id")
    .eq("active", true);

  if (!teamMembers || teamMembers.length < minTeam) {
    return [];
  }

  const memberIds = teamMembers.map((m) => m.id);

  // 4. Get recurring availability for this day of week
  const { data: availRows } = await supabase
    .from("availability")
    .select("*")
    .eq("day_of_week", dayOfWeek)
    .eq("active", true)
    .in("team_member_id", memberIds);

  // 5. Get overrides for this date
  const { data: overrideRows } = await supabase
    .from("availability_overrides")
    .select("*")
    .eq("date", date)
    .in("team_member_id", memberIds);

  // 6. Build per-member availability windows for this date
  const memberWindows: Map<string, { start: string; end: string }[]> = new Map();

  for (const memberId of memberIds) {
    const override = (overrideRows as OverrideRow[] | null)?.find(
      (o) => o.team_member_id === memberId
    );

    if (override) {
      // Override exists
      if (override.available && override.start_time && override.end_time) {
        memberWindows.set(memberId, [
          { start: override.start_time, end: override.end_time },
        ]);
      }
      // If override says not available, they get no windows (skip)
      continue;
    }

    // No override — use recurring availability
    const recurring = (availRows as AvailabilityRow[] | null)?.filter(
      (a) => a.team_member_id === memberId
    );

    if (recurring && recurring.length > 0) {
      memberWindows.set(
        memberId,
        recurring.map((a) => ({ start: a.start_time, end: a.end_time }))
      );
    }
  }

  // Not enough members available at all
  if (memberWindows.size < minTeam) {
    return [];
  }

  // 7. Get existing bookings for this date
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("scheduled_start, scheduled_end")
    .eq("scheduled_date", date)
    .not("status", "in", '("cancelled","refunded")');

  const bookings = (bookingRows as BookingRow[] | null) || [];

  // 8. Find the overall window (earliest start, latest end across all members)
  let earliestStart = "23:59";
  let latestEnd = "00:00";

  for (const windows of memberWindows.values()) {
    for (const w of windows) {
      if (w.start < earliestStart) earliestStart = w.start;
      if (w.end > latestEnd) latestEnd = w.end;
    }
  }

  // 9. Generate candidate slots at slotIncrement intervals
  const totalDuration = durationMinutes + travelBuffer;
  const slots: SlotResult[] = [];

  let cursor = timeToMinutes(earliestStart);
  const endLimit = timeToMinutes(latestEnd);

  while (cursor + totalDuration <= endLimit) {
    const slotStart = minutesToTime(cursor);
    const slotEnd = minutesToTime(cursor + durationMinutes);
    const blockEnd = minutesToTime(cursor + totalDuration);

    // Check: at least minTeam members are available for this slot
    let availableCount = 0;
    for (const [, windows] of memberWindows) {
      const memberAvailable = windows.some(
        (w) => w.start <= slotStart && w.end >= blockEnd
      );

      if (memberAvailable) {
        // Also check they're not booked
        const memberBusy = bookings.some((b) => {
          const bStart = b.scheduled_start.substring(0, 5);
          const bEnd = b.scheduled_end.substring(0, 5);
          const bEndWithBuffer = minutesToTime(
            timeToMinutes(bEnd) + travelBuffer
          );
          // Overlap check
          return slotStart < bEndWithBuffer && blockEnd > bStart;
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
