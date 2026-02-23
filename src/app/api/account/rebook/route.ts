import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — fetch a booking's details for rebooking (car size, addons, address, customer info)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("id");

  if (!bookingId) {
    return NextResponse.json(
      { error: "Booking ID is required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      car_size_id,
      address,
      notes,
      customer:customers(full_name, email, phone, address),
      booking_addons(addon_id)
    `
    )
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }

  const customer = booking.customer as unknown as {
    full_name: string;
    email: string;
    phone: string;
    address: string;
  } | null;

  const addonIds = (
    booking.booking_addons as unknown as { addon_id: string }[]
  ).map((ba) => ba.addon_id);

  return NextResponse.json({
    car_size_id: booking.car_size_id,
    addon_ids: addonIds,
    address: booking.address,
    notes: booking.notes,
    customer_name: customer?.full_name || "",
    customer_email: customer?.email || "",
    customer_phone: customer?.phone || "",
  });
}
