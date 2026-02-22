import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("service_area")
    .select("*")
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || null);
}

export async function PUT(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();

    if (!body.polygon) {
      return NextResponse.json({ error: "polygon is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Check if one exists already
    const { data: existing } = await supabase
      .from("service_area")
      .select("id")
      .limit(1)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from("service_area")
        .update({ polygon: body.polygon })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("service_area")
        .insert({ polygon: body.polygon })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    return NextResponse.json(result.data);
  });
}
