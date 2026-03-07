import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    }
    client = twilio(sid, token);
  }
  return client;
}

export async function sendSMS(to: string, body: string) {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    console.warn("TWILIO_PHONE_NUMBER not set — skipping SMS");
    return null;
  }

  // Normalize phone number — add +1 if needed
  let normalized = to.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    if (normalized.length === 10) normalized = "+1" + normalized;
    else if (normalized.length === 11 && normalized.startsWith("1"))
      normalized = "+" + normalized;
    else normalized = "+1" + normalized;
  }

  try {
    const message = await getTwilioClient().messages.create({
      body,
      from,
      to: normalized,
    });
    return message.sid;
  } catch (err) {
    console.error("Twilio SMS error:", err);
    return null;
  }
}

// ---- Message templates ----

export function bookingConfirmationText(data: {
  customerName: string;
  date: string;
  time: string;
  service: string;
  total: number;
  address: string;
}) {
  return `Hey ${data.customerName}! 🤠 Your car wash is booked!\n\n📅 ${data.date} at ${data.time}\n🚗 ${data.service}\n📍 ${data.address}\n💰 $${data.total}\n\nWe'll text you a reminder the day before. See ya! — Keep Austin Scrubbin'`;
}

export function dayBeforeReminderText(data: {
  customerName: string;
  time: string;
  address: string;
}) {
  return `Hey ${data.customerName}! Just a heads up — we'll be at ${data.address} tomorrow at ${data.time}. Make sure your car is accessible and we'll handle the rest! 🧽 — Keep Austin Scrubbin'`;
}

export function hourBeforeReminderText(data: {
  customerName: string;
  time: string;
}) {
  return `${data.customerName} — we're heading your way! See you at ${data.time}. 🤠 — Keep Austin Scrubbin'`;
}

export function completionText(data: {
  customerName: string;
}) {
  return `All done, ${data.customerName}! Your ride is looking fresh. ✨ Thanks for choosing Keep Austin Scrubbin'! Hope to see you again soon. 🤝`;
}
