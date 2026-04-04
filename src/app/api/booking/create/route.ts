import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { isSlotAvailable } from "@/lib/scheduling";
import { syncBookingEvent } from "@/lib/google-calendar";
import { sendEmail, bookingConfirmationEmail } from "@/lib/email";

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

  if (!car_size_id || !address || !scheduled_date || !scheduled_start || !customer_name || !customer_email || !customer_phone) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const hasAddons = addon_ids && addon_ids.length > 0;

  // 1. Fetch all independent data in parallel
  const [carSizeResult, addonResult, settingsResult, teamResult, customerResult] = await Promise.all([
    supabase.from("car_sizes").select("*").eq("id", car_size_id).single(),
    hasAddons
      ? supabase.from("addons").select("id, name, price, time_minutes").in("id", addon_ids)
      : Promise.resolve({ data: [] as { id: string; name: string; price: number; time_minutes: number }[], error: null }),
    supabase.from("settings").select("key, value"),
    supabase.from("team_members").select("id").eq("active", true),
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

  // 3. Lightweight slot availability check
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

  // 4. Calculate end time
  const [h, m] = scheduled_start.split(":").map(Number);
  const endMinutes = h * 60 + m + totalDuration;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const scheduled_end = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

  // 5. Find or create customer
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

  // 6. Create booking
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

  // 7. Insert addons + assign team + calendar sync + confirmation email in parallel
  const addonNames = addons.map((a) => a.name);

  const [, , calResult] = await Promise.all([
    // Insert booking addons
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
    // Assign team members
    activeMembers.length > 0
      ? supabase.from("booking_team_members").insert(
          activeMembers.map((m) => ({
            booking_id: booking.id,
            team_member_id: m.id,
          }))
        )
      : Promise.resolve(),
    // Sync to Google Calendar
    syncBookingEvent({
      status: "confirmed",
      customerName: customer_name,
      carSizeName: carSize.name,
      date: scheduled_date,
      startTime: scheduled_start,
      endTime: scheduled_end,
      address,
      total,
      notes: notes || null,
      addonNames,
    }).catch((err) => {
      console.error("Calendar sync failed:", err);
      return null;
    }),
    // Send confirmation email
    (async () => {
      const [eH, eM] = scheduled_start.split(":").map(Number);
      const eAmpm = eH >= 12 ? "PM" : "AM";
      const eHour = eH > 12 ? eH - 12 : eH === 0 ? 12 : eH;
      const emailTimeStr = `${eHour}:${eM.toString().padStart(2, "0")} ${eAmpm}`;
      const emailDateObj = new Date(scheduled_date + "T12:00:00");
      const emailDateStr = emailDateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const emailHtml = bookingConfirmationEmail({
        customerName: customer_name,
        date: emailDateStr,
        time: emailTimeStr,
        service: carSize.name || "Car Wash",
        servicePrice: Number(carSize.base_price),
        addons: addons.map((a) => ({ name: a.name, price: Number(a.price) })),
        tipAmount: 0,
        total,
        address,
      });

      await sendEmail(customer_email, "Your car wash is booked! 🤠", emailHtml);
    })(),
  ]);

  // Store calendar event ID if synced
  if (calResult) {
    await supabase
      .from("bookings")
      .update({ google_calendar_event_id: calResult as string })
      .eq("id", booking.id);
  }

  return NextResponse.json({
    booking_id: booking.id,
    total,
    scheduled_date,
    scheduled_start,
    scheduled_end,
  });
}
