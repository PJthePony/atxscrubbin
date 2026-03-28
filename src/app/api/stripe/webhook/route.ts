import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { sendSMS, bookingConfirmationText, smsOptInText } from "@/lib/twilio";

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
    const sessionType = session.metadata?.type;

    if (bookingId && sessionType === "tip") {
      // Handle post-wash tip payment
      const supabase = createServerClient();

      // Calculate tip amount from session (amount_total is in cents)
      const tipAmount = (session.amount_total || 0) / 100;

      await supabase
        .from("bookings")
        .update({
          tip_amount: tipAmount,
          tip_stripe_payment_intent_id: session.payment_intent,
        })
        .eq("id", bookingId);
    } else if (bookingId) {
      const supabase = createServerClient();

      // Update booking with Stripe payment intent ID
      await supabase
        .from("bookings")
        .update({
          stripe_payment_intent_id: session.payment_intent,
          status: "confirmed",
        })
        .eq("id", bookingId);

      // Send confirmation or opt-in text based on customer SMS preferences
      const { data: booking } = await supabase
        .from("bookings")
        .select("*, customer:customers(*), car_size:car_sizes(*)")
        .eq("id", bookingId)
        .single();

      if (booking?.customer?.phone && booking.customer.sms_opt_in) {
        if (booking.customer.sms_confirmed) {
          // Already confirmed — send booking confirmation text
          const [h, m] = booking.scheduled_start.split(":").map(Number);
          const ampm = h >= 12 ? "PM" : "AM";
          const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
          const timeStr = `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;

          const dateObj = new Date(booking.scheduled_date + "T12:00:00");
          const dateStr = dateObj.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });

          await sendSMS(
            booking.customer.phone,
            bookingConfirmationText({
              customerName: booking.customer.full_name,
              date: dateStr,
              time: timeStr,
              service: booking.car_size?.name || "Car Wash",
              total: booking.total,
              address: booking.address,
            })
          );
        } else {
          // New/unconfirmed number — send opt-in message instead
          await sendSMS(
            booking.customer.phone,
            smsOptInText({ customerName: booking.customer.full_name })
          );
        }
      }
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
