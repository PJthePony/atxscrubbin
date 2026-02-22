import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// GET — list bookings with optional filters
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const supabase = createServerClient();

    let query = supabase
      .from("bookings")
      .select(
        `
        *,
        customer:customers(*),
        car_size:car_sizes(*),
        booking_addons(*, addon:addons(*)),
        booking_team_members(*, team_member:team_members(id, display_name))
      `
      )
      .order("scheduled_date", { ascending: true })
      .order("scheduled_start", { ascending: true });

    if (status) {
      query = query.eq("status", status);
    }

    if (date) {
      query = query.eq("scheduled_date", date);
    }

    if (from) {
      query = query.gte("scheduled_date", from);
    }

    if (to) {
      query = query.lte("scheduled_date", to);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: data });
  });
}

// PATCH — update booking (status, notes, price, etc.)
export async function PATCH(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Only allow certain fields to be updated
    const allowed = [
      "status",
      "notes",
      "total",
      "subtotal",
      "scheduled_date",
      "scheduled_start",
      "scheduled_end",
      "address",
    ];

    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("bookings")
      .update(safeUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  });
}
