import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();

  const [sizesResult, addonsResult] = await Promise.all([
    supabase
      .from("car_sizes")
      .select("id, name, description, base_price, wash_time_minutes, sort_order")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("addons")
      .select("id, name, description, price, time_minutes, sort_order")
      .eq("active", true)
      .order("sort_order"),
  ]);

  if (sizesResult.error) {
    return NextResponse.json({ error: sizesResult.error.message }, { status: 500 });
  }
  if (addonsResult.error) {
    return NextResponse.json({ error: addonsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    car_sizes: sizesResult.data,
    addons: addonsResult.data,
  });
}
