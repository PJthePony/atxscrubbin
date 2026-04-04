import { NextResponse } from "next/server";
import { sendEmail, bookingConfirmationEmail, dayOfReminderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  const confirmationHtml = bookingConfirmationEmail({
    customerName: "P.J.",
    date: "Saturday, April 5, 2025",
    time: "2:00 PM",
    service: "Medium Wash",
    servicePrice: 55,
    addons: [
      { name: "Interior Wipe-Down", price: 20 },
      { name: "Tire Shine", price: 10 },
    ],
    tipAmount: 5,
    total: 90,
    address: "1234 South Lamar Blvd, Austin, TX 78704",
  });

  const confirmationResult = await sendEmail(
    "pjtanzillo@gmail.com",
    "Your car wash is booked! 🤠",
    confirmationHtml
  );

  const reminderHtml = dayOfReminderEmail({
    customerName: "P.J.",
    time: "2:00 PM",
    service: "Medium Wash",
    address: "1234 South Lamar Blvd, Austin, TX 78704",
  });

  const reminderResult = await sendEmail(
    "pjtanzillo@gmail.com",
    "Car wash day! See you today at 2:00 PM 🧽",
    reminderHtml
  );

  return NextResponse.json({
    confirmation: confirmationResult ? "sent" : "failed",
    reminder: reminderResult ? "sent" : "failed",
  });
}
