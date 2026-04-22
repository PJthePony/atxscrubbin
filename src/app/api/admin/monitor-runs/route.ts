import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return withAdmin(async () => {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("monitor_runs")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(60);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ runs: data || [] });
  });
}
