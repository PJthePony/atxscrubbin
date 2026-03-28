import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// GET — fetch booking summary for tip page
export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("booking_id");

  if (!bookingId) {
    return NextResponse.json(
      { error: "Missing booking_id" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, scheduled_date, scheduled_start, total, tip_amount, tip_stripe_payment_intent_id, status, customer:customers(full_name), car_size:car_sizes(name)")
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }

  const customer = booking.customer as unknown as { full_name: string } | null;
  const carSize = booking.car_size as unknown as { name: string } | null;

  return NextResponse.json({
    id: booking.id,
    customer_name: customer?.full_name || "",
    service: carSize?.name || "Car Wash",
    scheduled_date: booking.scheduled_date,
    scheduled_start: booking.scheduled_start,
    total: booking.total,
    tip_amount: booking.tip_amount,
    already_tipped: Number(booking.tip_amount) > 0 || !!booking.tip_stripe_payment_intent_id,
    status: booking.status,
  });
}

// POST — create Stripe checkout session for a tip
export async function POST(request: NextRequest) {
  const { booking_id, tip_amount } = await request.json();

  if (!booking_id || !tip_amount || Number(tip_amount) <= 0) {
    return NextResponse.json(
      { error: "Missing booking_id or valid tip_amount" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, tip_amount, tip_stripe_payment_intent_id, status, customer:customers(email)")
    .eq("id", booking_id)
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }

  // Don't allow double-tipping
  if (Number(booking.tip_amount) > 0 || booking.tip_stripe_payment_intent_id) {
    return NextResponse.json(
      { error: "A tip has already been added to this booking" },
      { status: 409 }
    );
  }

  const customer = booking.customer as unknown as { email: string } | null;
  const stripe = getStripe();
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: customer?.email || undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Tip for the crew" },
          unit_amount: Math.round(Number(tip_amount) * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      booking_id: booking.id,
      type: "tip",
    },
    success_url: `${origin}/tip/${booking.id}?thanks=true`,
    cancel_url: `${origin}/tip/${booking.id}`,
  });

  return NextResponse.json({ url: session.url });
}
