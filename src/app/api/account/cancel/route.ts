import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { deleteCalendarEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

// POST — cancel a booking (customer-facing, requires email verification)
export async function POST(request: NextRequest) {
  const { booking_id, customer_email } = await request.json();

  if (!booking_id || !customer_email) {
    return NextResponse.json(
      { error: "booking_id and customer_email are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Get the booking with customer info
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*, customer:customers(id, email)")
    .eq("id", booking_id)
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }

  // Verify email matches the customer
  const customer = booking.customer as unknown as { id: string; email: string } | null;
  if (!customer || customer.email.toLowerCase() !== customer_email.toLowerCase()) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 403 }
    );
  }

  // Check booking is cancellable
  if (booking.status === "cancelled" || booking.status === "refunded") {
    return NextResponse.json(
      { error: "This booking has already been cancelled" },
      { status: 400 }
    );
  }

  if (booking.status === "completed" || booking.status === "in_progress") {
    return NextResponse.json(
      { error: "This booking cannot be cancelled — it's already in progress or completed" },
      { status: 400 }
    );
  }

  // Check day-before policy: must cancel at least 24 hours before
  const now = new Date();
  const bookingDateTime = new Date(
    `${booking.scheduled_date}T${booking.scheduled_start}`
  );
  const hoursUntil =
    (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < 24) {
    return NextResponse.json(
      {
        error:
          "Bookings must be cancelled at least 24 hours in advance. Please reach out to us directly if you need help.",
      },
      { status: 400 }
    );
  }

  // Issue refund via Stripe if payment exists
  let refundId: string | null = null;
  if (booking.stripe_payment_intent_id) {
    try {
      const stripe = getStripe();
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
      });
      refundId = refund.id;
    } catch (stripeError) {
      console.error("Stripe refund failed:", stripeError);
      return NextResponse.json(
        { error: "Refund failed. Please contact us for help." },
        { status: 500 }
      );
    }
  }

  // Update booking status
  const updateData: Record<string, unknown> = {
    status: refundId ? "refunded" : "cancelled",
  };
  if (refundId) {
    updateData.stripe_refund_id = refundId;
  }

  await supabase.from("bookings").update(updateData).eq("id", booking_id);

  // Remove from Google Calendar
  if (booking.google_calendar_event_id) {
    deleteCalendarEvent(booking.google_calendar_event_id).catch(() => {});
    await supabase
      .from("bookings")
      .update({ google_calendar_event_id: null })
      .eq("id", booking_id);
  }

  return NextResponse.json({
    success: true,
    refunded: !!refundId,
    message: refundId
      ? "Your booking has been cancelled and your payment has been refunded."
      : "Your booking has been cancelled.",
  });
}
