import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  sendSMS,
  dayBeforeReminderText,
  hourBeforeReminderText,
} from "@/lib/twilio";
import { sendEmail, dayOfReminderEmail } from "@/lib/email";

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
  // Only send to customers who opted in AND confirmed via SMS reply
  const { data: dayBeforeBookings } = await supabase
    .from("bookings")
    .select("id, scheduled_start, address, customer:customers(full_name, phone, sms_opt_in, sms_confirmed)")
    .eq("scheduled_date", tomorrowStr)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .eq("reminder_day_before_sent", false);

  for (const booking of dayBeforeBookings || []) {
    const customer = booking.customer as unknown as { full_name: string; phone: string; sms_opt_in: boolean; sms_confirmed: boolean } | null;
    if (!customer?.phone) continue;
    if (!customer.sms_opt_in || !customer.sms_confirmed) continue;

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
  // Only send to customers who opted in AND confirmed via SMS reply
  const { data: hourBeforeBookings } = await supabase
    .from("bookings")
    .select("id, scheduled_start, customer:customers(full_name, phone, sms_opt_in, sms_confirmed)")
    .eq("scheduled_date", today)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .eq("reminder_hour_before_sent", false);

  for (const booking of hourBeforeBookings || []) {
    const customer = booking.customer as unknown as { full_name: string; phone: string; sms_opt_in: boolean; sms_confirmed: boolean } | null;
    if (!customer?.phone) continue;
    if (!customer.sms_opt_in || !customer.sms_confirmed) continue;

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

  // ---- Day-of email reminders ----
  // Send to bookings happening today that haven't been emailed yet
  let emailsSent = 0;
  const { data: todayEmailBookings } = await supabase
    .from("bookings")
    .select("id, scheduled_start, address, car_size:car_sizes(name), customer:customers(full_name, email)")
    .eq("scheduled_date", today)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .eq("reminder_email_sent", false);

  for (const booking of todayEmailBookings || []) {
    const customer = booking.customer as unknown as { full_name: string; email: string } | null;
    if (!customer?.email) continue;

    const carSize = booking.car_size as unknown as { name: string } | null;

    const [bH, bM] = booking.scheduled_start.split(":").map(Number);
    const ampm = bH >= 12 ? "PM" : "AM";
    const hour = bH > 12 ? bH - 12 : bH === 0 ? 12 : bH;
    const timeStr = `${hour}:${bM.toString().padStart(2, "0")} ${ampm}`;

    const emailHtml = dayOfReminderEmail({
      customerName: customer.full_name,
      time: timeStr,
      service: carSize?.name || "Car Wash",
      address: booking.address,
    });

    const result = await sendEmail(
      customer.email,
      `Car wash day! See you today at ${timeStr} 🧽`,
      emailHtml
    );

    if (result) {
      await supabase
        .from("bookings")
        .update({ reminder_email_sent: true })
        .eq("id", booking.id);
      emailsSent++;
    }
  }

  return NextResponse.json({ ok: true, sent, emailsSent });
}
