import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { isSlotAvailable, getAvailableTeamMemberIds } from "@/lib/scheduling";
import { decideCleanupAction } from "@/lib/booking-cleanup";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    car_size_id,
    addon_ids,
    address,
    lat,
    lng,
    scheduled_date,
    scheduled_start,
    customer_name,
    customer_email,
    customer_phone,
    sms_opt_in,
    notes,
    tip_amount,
  } = body;

  if (
    !car_size_id ||
    !address ||
    !scheduled_date ||
    !scheduled_start ||
    !customer_name ||
    !customer_email ||
    !customer_phone
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Validate contact fields before we touch the database or Stripe. An invalid
  // email is what created the prior orphan booking: the row inserted fine, then
  // Stripe rejected the address and threw, leaving a paymentless pending row.
  const email = String(customer_email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  const phoneDigits = String(customer_phone).replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    return NextResponse.json(
      { error: "Please enter a valid phone number." },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 1. Fetch all independent data in parallel
  const hasAddons = addon_ids && addon_ids.length > 0;

  const [carSizeResult, addonResult, settingsResult, customerResult] = await Promise.all([
    // Car size
    supabase.from("car_sizes").select("*").eq("id", car_size_id).single(),
    // Addons (if any)
    hasAddons
      ? supabase.from("addons").select("id, name, price, time_minutes").in("id", addon_ids)
      : Promise.resolve({ data: [] as { id: string; name: string; price: number; time_minutes: number }[], error: null }),
    // Settings
    supabase.from("settings").select("key, value"),
    // Existing customer lookup
    supabase.from("customers").select("id").eq("email", email).limit(1).single(),
  ]);

  const carSize = carSizeResult.data;
  if (carSizeResult.error || !carSize) {
    return NextResponse.json({ error: "Invalid car size" }, { status: 400 });
  }

  const addons = (addonResult.data || []) as { id: string; name: string; price: number; time_minutes: number }[];

  // Parse settings
  const settingsMap: Record<string, string> = {};
  for (const row of settingsResult.data || []) {
    settingsMap[row.key] = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
  }
  const travelBuffer = parseInt(settingsMap.travel_buffer_minutes || "10", 10);

  // 2. Calculate totals
  const addonTotal = addons.reduce((sum, a) => sum + Number(a.price), 0);
  const addonTime = addons.reduce((sum, a) => sum + a.time_minutes, 0);
  const totalDuration = carSize.wash_time_minutes + addonTime;
  const subtotal = Number(carSize.base_price) + addonTotal;
  const total = subtotal;

  // 3. Find or create customer
  let customerId: string;

  if (customerResult.data) {
    customerId = customerResult.data.id;
    await supabase
      .from("customers")
      .update({
        full_name: customer_name,
        phone: customer_phone,
        address,
        lat: lat || null,
        lng: lng || null,
        sms_opt_in: sms_opt_in ?? false,
      })
      .eq("id", customerId);
  } else {
    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        full_name: customer_name,
        email,
        phone: customer_phone,
        address,
        lat: lat || null,
        lng: lng || null,
        sms_opt_in: sms_opt_in ?? false,
      })
      .select("id")
      .single();

    if (customerError || !newCustomer) {
      return NextResponse.json(
        { error: "Failed to create customer record" },
        { status: 500 }
      );
    }
    customerId = newCustomer.id;
  }

  // 4. Clean up abandoned "pending" bookings BEFORE slot check. A booking
  // stays in 'pending' status until the Stripe webhook confirms payment.
  // We still verify each row with Stripe before deletion in case a webhook
  // raced the cleanup — if we find a paid session we self-heal instead.
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  const { data: candidateRows } = await supabase
    .from("bookings")
    .select("id, created_at, customer_id, stripe_checkout_session_id")
    .eq("status", "pending")
    .or(`customer_id.eq.${customerId},created_at.lt.${staleThreshold}`);

  for (const row of candidateRows || []) {
    try {
      if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY missing");

      // Verify with a deterministic GET on the stored Checkout Session id.
      // Stripe has no Search API for Checkout Sessions, and search elsewhere
      // lags behind reality — a direct retrieve reflects the true, current
      // payment state with no indexing delay. Legacy rows without a stored
      // session id resolve to `null`, which decideCleanupAction treats as
      // "keep" (never delete on absent evidence).
      let session: {
        status?: string | null;
        payment_status: string | null;
        payment_intent: string | { id: string } | null;
      } | null = null;

      if (row.stripe_checkout_session_id) {
        const res = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(
            row.stripe_checkout_session_id
          )}`,
          { headers: { Authorization: `Bearer ${stripeSecretKey}` } }
        );
        if (!res.ok) throw new Error(`Stripe retrieve failed: ${res.status}`);
        session = await res.json();
      }

      const decision = decideCleanupAction(session);
      if (decision.action === "heal") {
        // Self-heal: webhook missed this one. Promote to confirmed and attach the payment intent.
        await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            stripe_payment_intent_id: decision.paymentIntentId,
          })
          .eq("id", row.id);
        continue;
      }

      if (decision.action !== "delete") continue;

      // Age floor (defense in depth): never delete a pending row younger than
      // the stale threshold, even if it looks abandoned. A very recent row may
      // be mid-payment in another tab; this backstop alone would have prevented
      // the 2026-04 incident. The delete is also guarded by status=pending so a
      // webhook that confirms the row mid-cleanup is never clobbered.
      if (row.created_at >= staleThreshold) continue;

      await supabase
        .from("bookings")
        .delete()
        .eq("id", row.id)
        .eq("status", "pending");
    } catch (err) {
      console.error(`Cleanup skipped for booking ${row.id}:`, err);
      // Fail safe — never delete if we can't verify with Stripe.
    }
  }

  // 5. Lightweight slot availability check (single query instead of full recalculation)
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("scheduled_start, scheduled_end")
    .eq("scheduled_date", scheduled_date)
    .is("deleted_at", null)
    .not("status", "in", '("cancelled","refunded")');

  if (!isSlotAvailable(scheduled_start, totalDuration, travelBuffer, bookingRows || [])) {
    return NextResponse.json(
      { error: "This time slot is no longer available. Please choose another." },
      { status: 409 }
    );
  }

  // 6. Calculate end time
  const [h, m] = scheduled_start.split(":").map(Number);
  const endMinutes = h * 60 + m + totalDuration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const scheduled_end = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

  // 7. Create booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerId,
      car_size_id,
      scheduled_date,
      scheduled_start,
      scheduled_end,
      estimated_duration_minutes: totalDuration,
      address,
      lat: lat || null,
      lng: lng || null,
      notes: notes || null,
      subtotal,
      total,
      tip_amount: tip_amount && Number(tip_amount) > 0 ? Number(tip_amount) : 0,
      status: "pending",
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }

  // 8. Insert addons + assign the crew available that day in parallel
  const availableMemberIds = await getAvailableTeamMemberIds(scheduled_date);

  await Promise.all([
    addons.length > 0
      ? supabase.from("booking_addons").insert(
          addons.map((a) => ({
            booking_id: booking.id,
            addon_id: a.id,
            price_at_booking: a.price,
            time_at_booking: a.time_minutes,
          }))
        )
      : Promise.resolve(),
    availableMemberIds.length > 0
      ? supabase.from("booking_team_members").insert(
          availableMemberIds.map((id) => ({
            booking_id: booking.id,
            team_member_id: id,
          }))
        )
      : Promise.resolve(),
  ]);

  // 9. Build Stripe line items
  const lineItems: { price_data: { currency: string; product_data: { name: string; description?: string }; unit_amount: number }; quantity: number }[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `${carSize.name} Car Wash`,
          description: carSize.description,
        },
        unit_amount: Math.round(Number(carSize.base_price) * 100),
      },
      quantity: 1,
    },
  ];

  for (const addon of addons) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: addon.name },
        unit_amount: Math.round(Number(addon.price) * 100),
      },
      quantity: 1,
    });
  }

  const parsedTip = tip_amount && Number(tip_amount) > 0 ? Number(tip_amount) : 0;
  if (parsedTip > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Tip for the crew" },
        unit_amount: Math.round(parsedTip * 100),
      },
      quantity: 1,
    });
  }

  // 10. Create Stripe Checkout Session
  const stripe = getStripe();
  const origin = request.headers.get("origin") || "http://localhost:3000";

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      customer_email: email,
      line_items: lineItems,
      metadata: {
        booking_id: booking.id,
      },
      payment_intent_data: {
        receipt_email: undefined, // Suppress Stripe receipt — we send our own
      },
      success_url: `${origin}/book/success?booking_id=${booking.id}`,
      cancel_url: `${origin}/book?cancelled=true`,
    });
  } catch (err) {
    // Roll back the pending booking we just created so a failed checkout never
    // leaves a paymentless orphan row holding the slot. Scoped to this id and
    // guarded by status=pending so we can't touch a confirmed booking.
    console.error(`Stripe checkout creation failed for booking ${booking.id}:`, err);
    await supabase
      .from("bookings")
      .delete()
      .eq("id", booking.id)
      .eq("status", "pending");
    return NextResponse.json(
      { error: "We couldn't start checkout. Please check your details and try again." },
      { status: 502 }
    );
  }

  // Persist the session id so cleanup can later verify payment via a direct
  // retrieve (see the cleanup block above) instead of an unsupported search.
  await supabase
    .from("bookings")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", booking.id);

  return NextResponse.json({ url: session.url, booking_id: booking.id });
}
