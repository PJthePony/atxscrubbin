import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("addons")
    .select("*")
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("addons")
      .insert({
        name: body.name,
        description: body.description || "",
        price: body.price,
        time_minutes: body.time_minutes || 0,
        sort_order: body.sort_order || 0,
        active: body.active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  });
}

export async function PUT(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("addons")
      .update({
        name: body.name,
        description: body.description,
        price: body.price,
        time_minutes: body.time_minutes,
        sort_order: body.sort_order,
        active: body.active,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  });
}

export async function DELETE(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Try hard delete first
    const { error } = await supabase.from("addons").delete().eq("id", id);

    if (error) {
      // Foreign key constraint — addon was used in past bookings, deactivate instead
      if (error.code === "23503") {
        const { error: updateError } = await supabase
          .from("addons")
          .update({ active: false })
          .eq("id", id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, deactivated: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  });
}
