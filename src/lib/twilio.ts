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

// ---- Phone number normalization ----

export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    if (normalized.length === 10) normalized = "+1" + normalized;
    else if (normalized.length === 11 && normalized.startsWith("1"))
      normalized = "+" + normalized;
    else normalized = "+1" + normalized;
  }
  return normalized;
}

// ---- SMS sending ----

export async function sendSMS(to: string, body: string) {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    console.warn("TWILIO_PHONE_NUMBER not set — skipping SMS");
    return null;
  }

  const normalized = normalizePhone(to);

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
  tipLink?: string;
}) {
  const base = `All done, ${data.customerName}! Your ride is looking fresh. ✨ Thanks for choosing Keep Austin Scrubbin'!`;
  if (data.tipLink) {
    return `${base}\n\nWant to show the crew some love? Leave a tip here: ${data.tipLink} 🤝`;
  }
  return `${base} Hope to see you again soon. 🤝`;
}

export function smsOptInText(data: { customerName: string }) {
  return `Hey ${data.customerName}! ATX Scrubbin' here. 🤠 Reply Y to receive text updates about your appointments, or STOP to opt out anytime. Msg & data rates may apply.`;
}

export function smsOptInConfirmedText() {
  return `You're all set! 🎉 You'll get text reminders for your upcoming appointments. Reply STOP anytime to unsubscribe. — Keep Austin Scrubbin'`;
}

export function smsDefaultReplyText() {
  return `Text Y to opt in to appointment reminders, or STOP to opt out. For help, email atxscrubbin@gmail.com — Keep Austin Scrubbin'`;
}
