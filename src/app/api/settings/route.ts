import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return withAdmin(async () => {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("settings").select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert array of {key, value} to an object
    const settings: Record<string, unknown> = {};
    for (const row of data || []) {
      settings[row.key] = row.value;
    }
    return NextResponse.json(settings);
  });
}

export async function PUT(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();
    const supabase = createServerClient();

    // Upsert each key-value pair
    const entries = Object.entries(body);
    for (const [key, value] of entries) {
      const { error } = await supabase
        .from("settings")
        .upsert({ key, value: JSON.stringify(value) }, { onConflict: "key" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  });
}
