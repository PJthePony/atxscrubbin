import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";
import { sendSMS, completionText } from "@/lib/twilio";
import { sendEmail, bookingConfirmationEmail } from "@/lib/email";
import { syncBookingEvent, deleteCalendarEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

// GET — list bookings with optional filters
export async function GET(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const supabase = createServerClient();

    let query = supabase
      .from("bookings")
      .select(
        `
        *,
        customer:customers(*),
        car_size:car_sizes(*),
        booking_addons(*, addon:addons(*)),
        booking_team_members(*, team_member:team_members(id, display_name))
      `
      )
      .order("scheduled_date", { ascending: false })
      .order("scheduled_start", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (date) {
      query = query.eq("scheduled_date", date);
    }

    if (from) {
      query = query.gte("scheduled_date", from);
    }

    if (to) {
      query = query.lte("scheduled_date", to);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: data });
  });
}

// PATCH — update booking (status, notes, price, etc.)
export async function PATCH(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Only allow certain fields to be updated
    const allowed = [
      "status",
      "notes",
      "total",
      "subtotal",
      "scheduled_date",
      "scheduled_start",
      "scheduled_end",
      "address",
    ];

    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("bookings")
      .update(safeUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync to Google Calendar
    try {
      if (safeUpdates.status === "cancelled") {
        if (data.google_calendar_event_id) {
          await deleteCalendarEvent(data.google_calendar_event_id);
          await supabase
            .from("bookings")
            .update({ google_calendar_event_id: null })
            .eq("id", id);
        }
      } else {
        const { data: full } = await supabase
          .from("bookings")
          .select("*, customer:customers(full_name), car_size:car_sizes(name), booking_addons(addon:addons(name))")
          .eq("id", id)
          .single();

        if (full) {
          const customer = full.customer as unknown as { full_name: string } | null;
          const carSize = full.car_size as unknown as { name: string } | null;
          const addonNames = ((full.booking_addons || []) as unknown as { addon: { name: string } }[])
            .map((ba) => ba.addon?.name)
            .filter(Boolean);

          const eventId = await syncBookingEvent({
            status: full.status,
            customerName: customer?.full_name || "Unknown",
            carSizeName: carSize?.name || "Car Wash",
            date: full.scheduled_date,
            startTime: full.scheduled_start,
            endTime: full.scheduled_end,
            address: full.address,
            total: full.total,
            notes: full.notes,
            addonNames,
            existingEventId: full.google_calendar_event_id,
          });

          if (eventId && eventId !== full.google_calendar_event_id) {
            await supabase
              .from("bookings")
              .update({ google_calendar_event_id: eventId })
              .eq("id", id);
          }
        }
      }
    } catch (err) {
      console.error("Calendar sync failed:", err);
    }

    // Send completion text when status changes to completed
    if (safeUpdates.status === "completed" && data) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("tip_amount, customer:customers(full_name, phone)")
        .eq("id", id)
        .single();

      const customer = booking?.customer as unknown as { full_name: string; phone: string } | null;
      if (customer?.phone) {
        // Only include tip link if customer didn't tip at checkout
        const alreadyTipped = Number(booking?.tip_amount || 0) > 0;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://atxscrubbin.com";
        const tipLink = alreadyTipped ? undefined : `${baseUrl}/tip/${id}`;

        await sendSMS(
          customer.phone,
          completionText({ customerName: customer.full_name, tipLink })
        );

        await supabase
          .from("bookings")
          .update({ completion_notification_sent: true })
          .eq("id", id);
      }
    }

    return NextResponse.json(data);
  });
}

// POST — admin create booking (no Stripe, no slot validation)
export async function POST(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();

    const {
      car_size_id,
      addon_ids,
      address,
      scheduled_date,
      scheduled_start,
      customer_name,
      customer_email,
      customer_phone,
      notes,
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

    // Get car size
    const { data: carSize, error: sizeError } = await supabase
      .from("car_sizes")
      .select("*")
      .eq("id", car_size_id)
      .single();

    if (sizeError || !carSize) {
      return NextResponse.json({ error: "Invalid car size" }, { status: 400 });
    }

    // Get addons
    let addons: { id: string; name: string; price: number; time_minutes: number }[] = [];
    if (addon_ids && addon_ids.length > 0) {
      const { data: addonData } = await supabase
        .from("addons")
        .select("id, name, price, time_minutes")
        .in("id", addon_ids);
      addons = addonData || [];
    }

    // Calculate totals
    const addonTotal = addons.reduce((sum, a) => sum + a.price, 0);
    const addonTime = addons.reduce((sum, a) => sum + a.time_minutes, 0);
    const totalDuration = carSize.wash_time_minutes + addonTime;
    const subtotal = carSize.base_price + addonTotal;
    const total = subtotal;

    // Calculate end time
    const [h, m] = scheduled_start.split(":").map(Number);
    const endMinutes = h * 60 + m + totalDuration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const scheduled_end = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

    // Find or create customer
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

    // Create booking
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

    // Insert booking addons
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

    // Assign team members
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

    // Send confirmation email
    if (customer_email) {
      try {
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
      } catch (err) {
        console.error("Confirmation email failed:", err);
      }
    }

    return NextResponse.json({ booking_id: booking.id, total });
  });
}

// PUT — full edit of a booking (customer, service, schedule, addons)
export async function PUT(request: NextRequest) {
  return withAdmin(async () => {
    const body = await request.json();
    const {
      id,
      car_size_id,
      addon_ids,
      address,
      scheduled_date,
      scheduled_start,
      customer_name,
      customer_email,
      customer_phone,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get the existing booking to find customer_id
    const { data: existing, error: existingError } = await supabase
      .from("bookings")
      .select("customer_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Update customer info
    if (customer_name || customer_phone) {
      const customerUpdates: Record<string, string> = {};
      if (customer_name) customerUpdates.full_name = customer_name;
      if (customer_phone) customerUpdates.phone = customer_phone;
      if (address) customerUpdates.address = address;

      await supabase
        .from("customers")
        .update(customerUpdates)
        .eq("id", existing.customer_id);
    }

    // Build booking update
    const bookingUpdate: Record<string, unknown> = {};
    if (address) bookingUpdate.address = address;
    if (notes !== undefined) bookingUpdate.notes = notes || null;
    if (scheduled_date) bookingUpdate.scheduled_date = scheduled_date;

    // Recalculate pricing and duration if car size or addons changed
    if (car_size_id) {
      const { data: carSize } = await supabase
        .from("car_sizes")
        .select("*")
        .eq("id", car_size_id)
        .single();

      if (carSize) {
        let addonsData: { id: string; price: number; time_minutes: number }[] = [];
        if (addon_ids && addon_ids.length > 0) {
          const { data: ad } = await supabase
            .from("addons")
            .select("id, price, time_minutes")
            .in("id", addon_ids);
          addonsData = ad || [];
        }

        const addonTotal = addonsData.reduce((s, a) => s + a.price, 0);
        const addonTime = addonsData.reduce((s, a) => s + a.time_minutes, 0);
        const totalDuration = carSize.wash_time_minutes + addonTime;
        const subtotal = carSize.base_price + addonTotal;

        bookingUpdate.car_size_id = car_size_id;
        bookingUpdate.estimated_duration_minutes = totalDuration;
        bookingUpdate.subtotal = subtotal;
        bookingUpdate.total = subtotal;

        // Recalculate end time
        const startTime = scheduled_start || "";
        if (startTime) {
          const [h, m] = startTime.split(":").map(Number);
          const endMinutes = h * 60 + m + totalDuration;
          const endH = Math.floor(endMinutes / 60);
          const endM = endMinutes % 60;
          bookingUpdate.scheduled_start = startTime;
          bookingUpdate.scheduled_end = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
        }

        // Replace addons — delete old, insert new
        await supabase.from("booking_addons").delete().eq("booking_id", id);
        if (addonsData.length > 0) {
          await supabase.from("booking_addons").insert(
            addonsData.map((a) => ({
              booking_id: id,
              addon_id: a.id,
              price_at_booking: a.price,
              time_at_booking: a.time_minutes,
            }))
          );
        }
      }
    } else if (scheduled_start) {
      // Just updating time, no car size change — still recalc end time
      const { data: currentBooking } = await supabase
        .from("bookings")
        .select("estimated_duration_minutes")
        .eq("id", id)
        .single();

      if (currentBooking) {
        const [h, m] = scheduled_start.split(":").map(Number);
        const endMinutes = h * 60 + m + currentBooking.estimated_duration_minutes;
        const endH = Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        bookingUpdate.scheduled_start = scheduled_start;
        bookingUpdate.scheduled_end = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
      }
    }

    if (Object.keys(bookingUpdate).length > 0) {
      const { error: updateError } = await supabase
        .from("bookings")
        .update(bookingUpdate)
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    // Sync to Google Calendar
    try {
      const { data: full } = await supabase
        .from("bookings")
        .select("*, customer:customers(full_name), car_size:car_sizes(name), booking_addons(addon:addons(name))")
        .eq("id", id)
        .single();

      if (full) {
        const customer = full.customer as unknown as { full_name: string } | null;
        const carSize = full.car_size as unknown as { name: string } | null;
        const addonNames = ((full.booking_addons || []) as unknown as { addon: { name: string } }[])
          .map((ba) => ba.addon?.name)
          .filter(Boolean);

        const eventId = await syncBookingEvent({
          status: full.status,
          customerName: customer?.full_name || "Unknown",
          carSizeName: carSize?.name || "Car Wash",
          date: full.scheduled_date,
          startTime: full.scheduled_start,
          endTime: full.scheduled_end,
          address: full.address,
          total: full.total,
          notes: full.notes,
          addonNames,
          existingEventId: full.google_calendar_event_id,
        });

        if (eventId && eventId !== full.google_calendar_event_id) {
          await supabase
            .from("bookings")
            .update({ google_calendar_event_id: eventId })
            .eq("id", id);
        }
      }
    } catch (err) {
      console.error("Calendar sync failed:", err);
    }

    return NextResponse.json({ success: true });
  });
}

// DELETE — remove a booking and its related records
export async function DELETE(request: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch calendar event ID before deleting
    const { data: booking } = await supabase
      .from("bookings")
      .select("google_calendar_event_id")
      .eq("id", id)
      .single();

    // Delete related records first
    await supabase.from("booking_addons").delete().eq("booking_id", id);
    await supabase.from("booking_team_members").delete().eq("booking_id", id);

    const { error } = await supabase.from("bookings").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Remove from Google Calendar
    if (booking?.google_calendar_event_id) {
      deleteCalendarEvent(booking.google_calendar_event_id).catch(() => {});
    }

    return NextResponse.json({ success: true });
  });
}
