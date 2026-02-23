import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — look up customer bookings by email
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Find customer by email
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, address")
    .eq("email", email)
    .limit(1)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "No account found with that email. Have you booked with us before?" },
      { status: 404 }
    );
  }

  // Get all bookings for this customer
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      `
      *,
      car_size:car_sizes(id, name, base_price, wash_time_minutes),
      booking_addons(*, addon:addons(id, name, price))
    `
    )
    .eq("customer_id", customer.id)
    .order("scheduled_date", { ascending: false })
    .order("scheduled_start", { ascending: false });

  if (bookingsError) {
    return NextResponse.json(
      { error: "Failed to load bookings" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    customer: {
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    },
    bookings: bookings || [],
  });
}
