import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // If no webhook secret configured, just parse the event directly (dev mode)
  let event;
  const stripe = getStripe();

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      event = JSON.parse(body);
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.booking_id;

    if (bookingId) {
      const supabase = createServerClient();

      // Update booking with Stripe payment intent ID
      await supabase
        .from("bookings")
        .update({
          stripe_payment_intent_id: session.payment_intent,
          status: "confirmed",
        })
        .eq("id", bookingId);
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntentId = charge.payment_intent;

    if (paymentIntentId) {
      const supabase = createServerClient();

      // Find booking by payment intent and mark as refunded
      await supabase
        .from("bookings")
        .update({
          status: "refunded",
          stripe_refund_id: charge.refunds?.data?.[0]?.id || null,
        })
        .eq("stripe_payment_intent_id", paymentIntentId);
    }
  }

  return NextResponse.json({ received: true });
}
