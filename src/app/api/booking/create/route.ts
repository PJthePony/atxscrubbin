import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getAvailableSlots } from "@/lib/scheduling";
import { syncBookingEvent } from "@/lib/google-calendar";

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
    notes,
  } = body;

  // Validate required fields
  if (!car_size_id || !address || !scheduled_date || !scheduled_start || !customer_name || !customer_email || !customer_phone) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 1. Get car size for pricing and duration
  const { data: carSize, error: sizeError } = await supabase
    .from("car_sizes")
    .select("*")
    .eq("id", car_size_id)
    .single();

  if (sizeError || !carSize) {
    return NextResponse.json({ error: "Invalid car size" }, { status: 400 });
  }

  // 2. Get addons for pricing and duration
  let addons: { id: string; name: string; price: number; time_minutes: number }[] = [];
  if (addon_ids && addon_ids.length > 0) {
    const { data: addonData, error: addonError } = await supabase
      .from("addons")
      .select("id, name, price, time_minutes")
      .in("id", addon_ids);

    if (addonError) {
      return NextResponse.json({ error: "Failed to load addons" }, { status: 500 });
    }
    addons = addonData || [];
  }

  // 3. Calculate totals
  const addonTotal = addons.reduce((sum, a) => sum + a.price, 0);
  const addonTime = addons.reduce((sum, a) => sum + a.time_minutes, 0);
  const totalDuration = carSize.wash_time_minutes + addonTime;
  const subtotal = carSize.base_price + addonTotal;
  const total = subtotal; // No tax for now

  // 4. Verify the slot is still available
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
    // Update their info
    await supabase
      .from("customers")
      .update({
        full_name: customer_name,
        phone: customer_phone,
        address,
        lat: lat || null,
        lng: lng || null,
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
    const addonRows = addons.map((a) => ({
      booking_id: booking.id,
      addon_id: a.id,
      price_at_booking: a.price,
      time_at_booking: a.time_minutes,
    }));

    await supabase.from("booking_addons").insert(addonRows);
  }

  // 9. Assign team members (first minTeam available members)
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
    const teamRows = activeMembers.map((m) => ({
      booking_id: booking.id,
      team_member_id: m.id,
    }));

    await supabase.from("booking_team_members").insert(teamRows);
  }

  // Sync to Google Calendar
  try {
    const eventId = await syncBookingEvent({
      status: "confirmed",
      customerName: customer_name,
      carSizeName: carSize.name,
      date: scheduled_date,
      startTime: scheduled_start,
      endTime: scheduled_end,
      address,
      total,
      notes: notes || null,
      addonNames: addons.map((a) => a.name),
    });

    if (eventId) {
      await supabase
        .from("bookings")
        .update({ google_calendar_event_id: eventId })
        .eq("id", booking.id);
    }
  } catch (err) {
    console.error("Calendar sync failed:", err);
  }

  return NextResponse.json({
    booking_id: booking.id,
    total,
    scheduled_date,
    scheduled_start,
    scheduled_end,
  });
}
