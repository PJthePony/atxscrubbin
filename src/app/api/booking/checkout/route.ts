import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { getAvailableSlots } from "@/lib/scheduling";

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
    email_opt_in,
    notes,
  } = body;

  // Validate required fields
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

  // 1. Get car size
  const { data: carSize, error: sizeError } = await supabase
    .from("car_sizes")
    .select("*")
    .eq("id", car_size_id)
    .single();

  if (sizeError || !carSize) {
    return NextResponse.json({ error: "Invalid car size" }, { status: 400 });
  }

  // 2. Get addons
  let addons: { id: string; name: string; price: number; time_minutes: number }[] = [];
  if (addon_ids && addon_ids.length > 0) {
    const { data: addonData } = await supabase
      .from("addons")
      .select("id, name, price, time_minutes")
      .in("id", addon_ids);
    addons = addonData || [];
  }

  // 3. Calculate totals
  const addonTotal = addons.reduce((sum, a) => sum + Number(a.price), 0);
  const addonTime = addons.reduce((sum, a) => sum + a.time_minutes, 0);
  const totalDuration = carSize.wash_time_minutes + addonTime;
  const subtotal = Number(carSize.base_price) + addonTotal;
  const total = subtotal;

  // 4. Verify slot is still available
  const slots = await getAvailableSlots(scheduled_date, totalDuration);
  const slotAvailable = slots.some((s) => s.start === scheduled_start);

  if (!slotAvailable) {
    return NextResponse.json(
      { error: "This time slot is no longer available. Please choose another." },
      { status: 409 }
    );
  }

  // 5. Calculate end time
  const [h, m] = scheduled_start.split(":").map(Number);
  const endMinutes = h * 60 + m + totalDuration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const scheduled_end = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

  // 6. Find or create customer
  let customerId: string;

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("email", customer_email)
    .limit(1)
    .single();

  if (existingCustomer) {
    customerId = existingCustomer.id;
    await supabase
      .from("customers")
      .update({
        full_name: customer_name,
        phone: customer_phone,
        address,
        lat: lat || null,
        lng: lng || null,
        sms_opt_in: sms_opt_in ?? false,
        email_opt_in: email_opt_in ?? false,
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
        email_opt_in: email_opt_in ?? false,
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

  // 7. Create booking with status 'confirmed' (payment pending)
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
      status: "confirmed",
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }

  // 8. Insert booking addons
  if (addons.length > 0) {
    await supabase.from("booking_addons").insert(
      addons.map((a) => ({
        booking_id: booking.id,
        addon_id: a.id,
        price_at_booking: a.price,
        time_at_booking: a.time_minutes,
      }))
    );
  }

  // 9. Assign team members
  const { data: settingsRows } = await supabase
    .from("settings")
    .select("key, value")
    .eq("key", "min_team_members_per_booking");
  const minTeam = settingsRows?.[0]
    ? parseInt(String(settingsRows[0].value), 10)
    : 2;

  const { data: activeMembers } = await supabase
    .from("team_members")
    .select("id")
    .eq("active", true)
    .limit(minTeam);

  if (activeMembers && activeMembers.length > 0) {
    await supabase.from("booking_team_members").insert(
      activeMembers.map((m) => ({
        booking_id: booking.id,
        team_member_id: m.id,
      }))
    );
  }

  // 10. Build Stripe line items
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

  // 11. Create Stripe Checkout Session
  const stripe = getStripe();
  const origin = request.headers.get("origin") || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: customer_email,
    line_items: lineItems,
    metadata: {
      booking_id: booking.id,
    },
    success_url: `${origin}/book/success?booking_id=${booking.id}`,
    cancel_url: `${origin}/book?cancelled=true`,
  });

  return NextResponse.json({ url: session.url, booking_id: booking.id });
}
