import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// GET — compute payroll for a given week
// Query params: weekStart (YYYY-MM-DD, Monday of the week)
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");

    if (!weekStart) {
      return NextResponse.json(
        { error: "weekStart is required (YYYY-MM-DD, Monday)" },
        { status: 400 }
      );
    }

    // Calculate week end (Sunday)
    const start = new Date(weekStart + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const weekEnd = end.toISOString().split("T")[0];

    const supabase = createServerClient();

    // Fetch completed bookings for the week with team member assignments
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `
        id,
        total,
        tip_amount,
        status,
        scheduled_date,
        scheduled_start,
        customer:customers(full_name),
        car_size:car_sizes(name),
        booking_team_members(team_member:team_members(id, display_name))
      `
      )
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd)
      .eq("status", "completed")
      .order("scheduled_date", { ascending: true })
      .order("scheduled_start", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch all active team members for the roster
    const { data: allMembers } = await supabase
      .from("team_members")
      .select("id, display_name")
      .eq("active", true)
      .order("display_name");

    const CREW_SHARE = 0.75;
    const COMPANY_SHARE = 0.25;

    // Per-member earnings accumulator
    const memberEarnings: Record<
      string,
      { name: string; washEarnings: number; tipEarnings: number; washCount: number }
    > = {};

    // Initialize all active members
    for (const m of allMembers || []) {
      memberEarnings[m.id] = {
        name: m.display_name,
        washEarnings: 0,
        tipEarnings: 0,
        washCount: 0,
      };
    }

    let totalRevenue = 0;
    let totalTips = 0;
    let companyShare = 0;

    const bookingDetails = [];

    for (const booking of bookings || []) {
      const total = Number(booking.total) || 0;
      const tip = Number(booking.tip_amount) || 0;
      const members = (
        booking.booking_team_members as {
          team_member: { id: string; display_name: string };
        }[]
      ).map((btm) => btm.team_member);

      totalRevenue += total;
      totalTips += tip;

      const crewTotal = total * CREW_SHARE;
      const companyTotal = total * COMPANY_SHARE;
      companyShare += companyTotal;

      const memberCount = members.length || 1;
      const perPersonWash = crewTotal / memberCount;
      const perPersonTip = tip / memberCount;

      for (const member of members) {
        if (!memberEarnings[member.id]) {
          memberEarnings[member.id] = {
            name: member.display_name,
            washEarnings: 0,
            tipEarnings: 0,
            washCount: 0,
          };
        }
        memberEarnings[member.id].washEarnings += perPersonWash;
        memberEarnings[member.id].tipEarnings += perPersonTip;
        memberEarnings[member.id].washCount += 1;
      }

      const customer = booking.customer as unknown as { full_name: string } | null;
      const carSize = booking.car_size as unknown as { name: string } | null;

      bookingDetails.push({
        id: booking.id,
        date: booking.scheduled_date,
        time: booking.scheduled_start,
        customer: customer?.full_name || "Unknown",
        service: carSize?.name || "Car Wash",
        total,
        tip,
        crewShare: crewTotal,
        companyShare: companyTotal,
        members: members.map((m) => m.display_name),
      });
    }

    // Build member summary (only include members who worked or are active)
    const memberSummary = Object.entries(memberEarnings)
      .map(([id, data]) => ({
        id,
        name: data.name,
        washEarnings: Math.round(data.washEarnings * 100) / 100,
        tipEarnings: Math.round(data.tipEarnings * 100) / 100,
        totalEarnings:
          Math.round((data.washEarnings + data.tipEarnings) * 100) / 100,
        washCount: data.washCount,
      }))
      .filter((m) => m.washCount > 0)
      .sort((a, b) => b.totalEarnings - a.totalEarnings);

    return NextResponse.json({
      weekStart,
      weekEnd,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      companyShare: Math.round(companyShare * 100) / 100,
      crewShare:
        Math.round(totalRevenue * CREW_SHARE * 100) / 100,
      bookingCount: (bookings || []).length,
      members: memberSummary,
      bookings: bookingDetails,
    });
  });
}
