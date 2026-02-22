import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// GET availability for a team member (or all)
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("member_id");

    const supabase = createServerClient();

    // Get recurring availability
    let availQuery = supabase.from("availability").select("*").order("day_of_week");
    if (memberId) availQuery = availQuery.eq("team_member_id", memberId);
    const { data: availability, error: availError } = await availQuery;

    if (availError) {
      return NextResponse.json({ error: availError.message }, { status: 500 });
    }

    // Get overrides
    let overrideQuery = supabase.from("availability_overrides").select("*").order("date");
    if (memberId) overrideQuery = overrideQuery.eq("team_member_id", memberId);
    const { data: overrides, error: overrideError } = await overrideQuery;

    if (overrideError) {
      return NextResponse.json({ error: overrideError.message }, { status: 500 });
    }

    return NextResponse.json({ availability, overrides });
  });
}

// POST — set recurring availability for a team member
export async function POST(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();

    if (!body.team_member_id || body.day_of_week === undefined) {
      return NextResponse.json(
        { error: "team_member_id and day_of_week are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("availability")
      .upsert(
        {
          team_member_id: body.team_member_id,
          day_of_week: body.day_of_week,
          start_time: body.start_time || "10:00",
          end_time: body.end_time || "16:00",
          active: body.active ?? true,
        },
        { onConflict: "team_member_id,day_of_week" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  });
}

// PUT — set/update a date override
export async function PUT(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();

    if (!body.team_member_id || !body.date) {
      return NextResponse.json(
        { error: "team_member_id and date are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("availability_overrides")
      .upsert(
        {
          team_member_id: body.team_member_id,
          date: body.date,
          available: body.available ?? false,
          start_time: body.start_time || null,
          end_time: body.end_time || null,
        },
        { onConflict: "team_member_id,date" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  });
}

// DELETE — remove an override
export async function DELETE(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("availability_overrides")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  });
}
