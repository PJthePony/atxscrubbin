import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  sendSMS,
  dayBeforeReminderText,
  hourBeforeReminderText,
} from "@/lib/twilio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();

  // Central Time offset (UTC-6 or UTC-5 for DST)
  // For simplicity, use UTC-6 (CST). Fine-tune later if needed.
  const ct = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const today = ct.toISOString().split("T")[0];
  const currentHour = ct.getHours();
  const currentMinute = ct.getMinutes();

  // Tomorrow's date
  const tomorrow = new Date(ct);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  let sent = 0;

  // ---- Day-before reminders ----
  // Send to bookings happening tomorrow that haven't been reminded yet
  const { data: dayBeforeBookings } = await supabase
    .from("bookings")
    .select("id, scheduled_start, address, customer:customers(full_name, phone)")
    .eq("scheduled_date", tomorrowStr)
    .eq("status", "confirmed")
    .eq("reminder_day_before_sent", false);

  for (const booking of dayBeforeBookings || []) {
    const customer = booking.customer as unknown as { full_name: string; phone: string } | null;
    if (!customer?.phone) continue;

    const [h, m] = booking.scheduled_start.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const timeStr = `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;

    await sendSMS(
      customer.phone,
      dayBeforeReminderText({
        customerName: customer.full_name,
        time: timeStr,
        address: booking.address,
      })
    );

    await supabase
      .from("bookings")
      .update({ reminder_day_before_sent: true })
      .eq("id", booking.id);

    sent++;
  }

  // ---- Hour-before reminders ----
  // Send to bookings happening today within the next hour
  const { data: hourBeforeBookings } = await supabase
    .from("bookings")
    .select("id, scheduled_start, customer:customers(full_name, phone)")
    .eq("scheduled_date", today)
    .eq("status", "confirmed")
    .eq("reminder_hour_before_sent", false);

  for (const booking of hourBeforeBookings || []) {
    const customer = booking.customer as unknown as { full_name: string; phone: string } | null;
    if (!customer?.phone) continue;

    const [bH, bM] = booking.scheduled_start.split(":").map(Number);
    const bookingMinutes = bH * 60 + bM;
    const nowMinutes = currentHour * 60 + currentMinute;

    // Send if booking is 45-75 minutes away (roughly 1 hour before)
    const diff = bookingMinutes - nowMinutes;
    if (diff < 45 || diff > 75) continue;

    const ampm = bH >= 12 ? "PM" : "AM";
    const hour = bH > 12 ? bH - 12 : bH === 0 ? 12 : bH;
    const timeStr = `${hour}:${bM.toString().padStart(2, "0")} ${ampm}`;

    await sendSMS(
      customer.phone,
      hourBeforeReminderText({
        customerName: customer.full_name,
        time: timeStr,
      })
    );

    await supabase
      .from("bookings")
      .update({ reminder_hour_before_sent: true })
      .eq("id", booking.id);

    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
