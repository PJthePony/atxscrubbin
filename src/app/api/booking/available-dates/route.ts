import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Returns dates that have at least min_team_members available
 * in the given range. Used by the booking calendar to show
 * which dates are potentially bookable.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Load min_team_members setting
  const { data: settingsRows } = await supabase
    .from("settings")
    .select("key, value")
    .eq("key", "min_team_members_per_booking");

  const minTeam = settingsRows?.[0]
    ? parseInt(
        typeof settingsRows[0].value === "string"
          ? settingsRows[0].value
          : JSON.stringify(settingsRows[0].value),
        10
      )
    : 2;

  // Get active team member IDs
  const { data: activeMembers } = await supabase
    .from("team_members")
    .select("id")
    .eq("active", true);

  const activeMemberIds = (activeMembers || []).map((m) => m.id);
  if (activeMemberIds.length < minTeam) {
    return NextResponse.json({ availableDates: [] });
  }

  // Get all availability overrides in the range
  const { data: overrides } = await supabase
    .from("availability_overrides")
    .select("date")
    .eq("available", true)
    .in("team_member_id", activeMemberIds)
    .gte("date", from)
    .lte("date", to);

  // Count members per date
  const counts: Record<string, number> = {};
  for (const row of overrides || []) {
    const dateStr =
      typeof row.date === "string" ? row.date.substring(0, 10) : row.date;
    counts[dateStr] = (counts[dateStr] || 0) + 1;
  }

  // Return dates with enough team members
  const availableDates = Object.entries(counts)
    .filter(([, count]) => count >= minTeam)
    .map(([date]) => date);

  return NextResponse.json({ availableDates });
}
