import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { withAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withAdmin(async () => {
    const { booking_id } = await request.json();

    if (!booking_id) {
      return NextResponse.json(
        { error: "booking_id is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get the booking
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, stripe_payment_intent_id, status")
      .eq("id", booking_id)
      .single();

    if (error || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (!booking.stripe_payment_intent_id) {
      return NextResponse.json(
        { error: "No payment found for this booking" },
        { status: 400 }
      );
    }

    if (booking.status === "refunded") {
      return NextResponse.json(
        { error: "Already refunded" },
        { status: 400 }
      );
    }

    // Issue refund via Stripe
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
    });

    // Update booking
    await supabase
      .from("bookings")
      .update({
        status: "refunded",
        stripe_refund_id: refund.id,
      })
      .eq("id", booking_id);

    return NextResponse.json({ success: true, refund_id: refund.id });
  });
}
