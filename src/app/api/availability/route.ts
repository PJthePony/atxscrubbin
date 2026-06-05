import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";
import { syncAvailabilityEvent, deleteCalendarEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

// GET availability for a date range
// Returns myDates (dates the given member is available) and teamCounts (all active members per date)
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("member_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const supabase = createServerClient();

    // Get active team member IDs
    const { data: activeMembers } = await supabase
      .from("team_members")
      .select("id")
      .eq("active", true);

    const activeMemberIds = (activeMembers || []).map((m) => m.id);
    if (activeMemberIds.length === 0) {
      return NextResponse.json({ myDates: [], teamCounts: {} });
    }

    // Query all availability_overrides with available=true for the date range
    let query = supabase
      .from("availability_overrides")
      .select("team_member_id, date")
      .eq("available", true)
      .in("team_member_id", activeMemberIds);

    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data: overrides, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const myDates: string[] = [];
    const teamCounts: Record<string, number> = {};

    for (const row of overrides || []) {
      const dateStr =
        typeof row.date === "string" ? row.date.substring(0, 10) : row.date;
      teamCounts[dateStr] = (teamCounts[dateStr] || 0) + 1;
      if (memberId && row.team_member_id === memberId) {
        myDates.push(dateStr);
      }
    }

    // Get booking counts per date for the range
    let bookingQuery = supabase
      .from("bookings")
      .select("scheduled_date")
      .is("deleted_at", null)
      .not("status", "in", '("cancelled","refunded")');

    if (from) bookingQuery = bookingQuery.gte("scheduled_date", from);
    if (to) bookingQuery = bookingQuery.lte("scheduled_date", to);

    const { data: bookingRows } = await bookingQuery;

    const bookingCounts: Record<string, number> = {};
    for (const row of bookingRows || []) {
      const dateStr =
        typeof row.scheduled_date === "string"
          ? row.scheduled_date.substring(0, 10)
          : row.scheduled_date;
      bookingCounts[dateStr] = (bookingCounts[dateStr] || 0) + 1;
    }

    return NextResponse.json({ myDates, teamCounts, bookingCounts });
  });
}

// POST — toggle a specific date on or off for a team member
// available=true: upsert with 11:00–16:00
// available=false: delete the record
export async function POST(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();

    if (!body.team_member_id || !body.date) {
      return NextResponse.json(
        { error: "team_member_id and date are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    if (body.available === false) {
      // Fetch existing event ID before deleting
      const { data: existing } = await supabase
        .from("availability_overrides")
        .select("google_calendar_event_id")
        .eq("team_member_id", body.team_member_id)
        .eq("date", body.date)
        .single();

      const { error } = await supabase
        .from("availability_overrides")
        .delete()
        .eq("team_member_id", body.team_member_id)
        .eq("date", body.date);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Remove from Google Calendar
      if (existing?.google_calendar_event_id) {
        deleteCalendarEvent(existing.google_calendar_event_id).catch(() => {});
      }

      return NextResponse.json({ success: true });
    }

    // available=true — upsert with fixed 11:00–16:00 window
    const { data, error } = await supabase
      .from("availability_overrides")
      .upsert(
        {
          team_member_id: body.team_member_id,
          date: body.date,
          available: true,
          start_time: "11:00",
          end_time: "16:00",
        },
        { onConflict: "team_member_id,date" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync to Google Calendar
    try {
      const { data: member } = await supabase
        .from("team_members")
        .select("display_name")
        .eq("id", body.team_member_id)
        .single();

      if (member) {
        const eventId = await syncAvailabilityEvent({
          teamMemberName: member.display_name,
          date: body.date,
          startTime: "11:00",
          endTime: "16:00",
          existingEventId: data.google_calendar_event_id,
        });

        if (eventId && eventId !== data.google_calendar_event_id) {
          await supabase
            .from("availability_overrides")
            .update({ google_calendar_event_id: eventId })
            .eq("id", data.id);
        }
      }
    } catch (err) {
      console.error("Calendar sync failed:", err);
    }

    return NextResponse.json(data);
  });
}

// DELETE — remove an override by id (kept for admin use)
export async function DELETE(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch event ID before deleting
    const { data: existing } = await supabase
      .from("availability_overrides")
      .select("google_calendar_event_id")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("availability_overrides")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (existing?.google_calendar_event_id) {
      deleteCalendarEvent(existing.google_calendar_event_id).catch(() => {});
    }

    return NextResponse.json({ success: true });
  });
}
