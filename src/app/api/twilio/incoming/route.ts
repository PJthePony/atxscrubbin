import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  sendSMS,
  normalizePhone,
  smsOptInConfirmedText,
  smsDefaultReplyText,
  bookingConfirmationText,
} from "@/lib/twilio";
import { sendEmail } from "@/lib/email";
import twilio from "twilio";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Parse form-encoded body from Twilio
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = (formData.get("Body") as string || "").trim();

  if (!from || !body) {
    return new NextResponse(twimlResponse(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Validate Twilio signature
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = request.headers.get("x-twilio-signature") || "";
    const url = request.url;

    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value as string;
    });

    const isValid = twilio.validateRequest(authToken, signature, url, params);
    if (!isValid) {
      console.warn("Invalid Twilio signature — rejecting incoming SMS");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  const supabase = createServerClient();
  const normalizedPhone = normalizePhone(from);

  // Look up customer by phone number (try both normalized and raw)
  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, phone, sms_opt_in, sms_confirmed")
    .or(`phone.eq.${normalizedPhone},phone.eq.${from.replace("+1", "")},phone.eq.${from}`)
    .limit(1)
    .single();

  if (!customer) {
    // Unknown number — send default reply
    await sendSMS(from, smsDefaultReplyText());

    // Forward to email so the team can see it
    await sendEmail(
      "keep.austin.scrubbin@gmail.com",
      `Text from unknown number (${from})`,
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#E06030;margin-bottom:16px;">Incoming Text Message</h2>
        <p><strong>From:</strong> ${from} (not in customer database)</p>
        <p><strong>Message:</strong></p>
        <blockquote style="border-left:3px solid #E06030;padding:8px 16px;margin:12px 0;color:#555;background:#FAF5F0;border-radius:4px;">
          ${body}
        </blockquote>
        <hr style="border:none;border-top:1px solid #E8D5C0;margin:24px 0;">
        <p style="font-size:13px;color:#999;">This text was sent to the Keep Austin Scrubbin' phone line. The sender received an auto-reply with opt-in instructions.</p>
      </div>`
    );

    return new NextResponse(twimlResponse(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const upperBody = body.toUpperCase();

  if (upperBody === "Y" || upperBody === "YES") {
    // Confirm opt-in
    await supabase
      .from("customers")
      .update({ sms_confirmed: true })
      .eq("id", customer.id);

    // Send confirmation reply
    await sendSMS(customer.phone, smsOptInConfirmedText());

    // Send pending booking confirmation for their latest confirmed booking
    const { data: latestBooking } = await supabase
      .from("bookings")
      .select("*, car_size:car_sizes(*)")
      .eq("customer_id", customer.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestBooking) {
      const [h, m] = latestBooking.scheduled_start.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const timeStr = `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;

      const dateObj = new Date(latestBooking.scheduled_date + "T12:00:00");
      const dateStr = dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      await sendSMS(
        customer.phone,
        bookingConfirmationText({
          customerName: customer.full_name,
          date: dateStr,
          time: timeStr,
          service: latestBooking.car_size?.name || "Car Wash",
          total: latestBooking.total,
          address: latestBooking.address,
        })
      );
    }
  } else {
    // Any other message — send default reply
    // Note: STOP/UNSUBSCRIBE are handled automatically by Twilio
    await sendSMS(customer.phone, smsDefaultReplyText());

    // Forward the message to email so the team can see it
    const customerName = customer.full_name || "Unknown";
    await sendEmail(
      "keep.austin.scrubbin@gmail.com",
      `Text from ${customerName} (${from})`,
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#E06030;margin-bottom:16px;">Incoming Text Message</h2>
        <p><strong>From:</strong> ${customerName} (${from})</p>
        <p><strong>Message:</strong></p>
        <blockquote style="border-left:3px solid #E06030;padding:8px 16px;margin:12px 0;color:#555;background:#FAF5F0;border-radius:4px;">
          ${body}
        </blockquote>
        <hr style="border:none;border-top:1px solid #E8D5C0;margin:24px 0;">
        <p style="font-size:13px;color:#999;">This text was sent to the Keep Austin Scrubbin' phone line. The customer received an auto-reply with opt-in instructions.</p>
      </div>`
    );
  }

  return new NextResponse(twimlResponse(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function twimlResponse() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}
