import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { isSlotAvailable } from "@/lib/scheduling";
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

  const supabase = createServerClient();

  // 1. Fetch all independent data in parallel
  const hasAddons = addon_ids && addon_ids.length > 0;

  const [carSizeResult, addonResult, settingsResult, teamResult, customerResult] = await Promise.all([
    // Car size
    supabase.from("car_sizes").select("*").eq("id", car_size_id).single(),
    // Addons (if any)
    hasAddons
      ? supabase.from("addons").select("id, name, price, time_minutes").in("id", addon_ids)
      : Promise.resolve({ data: [] as { id: string; name: string; price: number; time_minutes: number }[], error: null }),
    // Settings
    supabase.from("settings").select("key, value"),
    // Active team members
    supabase.from("team_members").select("id").eq("active", true),
    // Existing customer lookup
    supabase.from("customers").select("id").eq("email", customer_email).limit(1).single(),
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
  const minTeam = parseInt(settingsMap.min_team_members_per_booking || "2", 10);
  const activeMembers = (teamResult.data || []).slice(0, minTeam);

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
        email: customer_email,
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
    .select("id, created_at, customer_id")
    .eq("status", "pending")
    .or(`customer_id.eq.${customerId},created_at.lt.${staleThreshold}`);

  for (const row of candidateRows || []) {
    try {
      // The Stripe Node SDK in this project doesn't expose `sessions.search`,
      // so call the Search API directly. This is more efficient than listing
      // every session in the account.
      if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY missing");
      const query = `metadata['booking_id']:'${row.id}'`;
      const res = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/search?query=${encodeURIComponent(query)}&limit=5`,
        { headers: { Authorization: `Bearer ${stripeSecretKey}` } }
      );
      if (!res.ok) throw new Error(`Stripe search failed: ${res.status}`);
      const search = (await res.json()) as {
        data: Array<{ payment_status: string | null; payment_intent: string | { id: string } | null }>;
      };
      const decision = decideCleanupAction(search.data);
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
      // decision.action === "delete" — truly abandoned. Guard with status=pending
      // to ensure we never delete a confirmed/completed booking even in race conditions.
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

  // 8. Insert addons + assign team members in parallel
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
    activeMembers.length > 0
      ? supabase.from("booking_team_members").insert(
          activeMembers.map((m) => ({
            booking_id: booking.id,
            team_member_id: m.id,
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    customer_email: customer_email,
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

  return NextResponse.json({ url: session.url, booking_id: booking.id });
}
