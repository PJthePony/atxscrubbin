import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const FROM_EMAIL = "Keep Austin Scrubbin' <no-reply@atxscrubbin.com>";
const REPLY_TO = "keep.austin.scrubbin@gmail.com";
const LOGO_URL = "https://www.atxscrubbin.com/logo-color.png";

// ---- Email sending ----

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      replyTo: REPLY_TO,
      html,
    });

    if (error) {
      console.error("Resend email error:", error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("Email send error:", err);
    return null;
  }
}

// ---- Shared layout ----

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Keep Austin Scrubbin'</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#333333;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF5F0;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- Header -->
<tr><td align="center" style="padding:32px 24px 16px;background-color:#ffffff;">
<img src="${LOGO_URL}" alt="Keep Austin Scrubbin'" width="120" height="120" style="display:block;border:0;border-radius:12px;">
</td></tr>
<tr><td style="padding:0 32px;">
<hr style="border:none;height:3px;background-color:#E06030;border-radius:2px;margin:0;">
</td></tr>

<!-- Content -->
<tr><td style="padding:24px 32px 32px;">
${content}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 32px;background-color:#FAF5F0;border-top:1px solid #E8D5C0;">
<p style="margin:0 0 8px;font-size:14px;color:#6B5D50;text-align:center;">
<strong style="color:#E06030;">Keep Austin Scrubbin'</strong> — Mobile car wash, Austin TX
</p>
<p style="margin:0;font-size:13px;color:#999999;text-align:center;">
Questions? Reply to this email or reach us at <a href="mailto:keep.austin.scrubbin@gmail.com" style="color:#E06030;">keep.austin.scrubbin@gmail.com</a>
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---- Booking Confirmation Email ----

export function bookingConfirmationEmail(data: {
  customerName: string;
  date: string;
  time: string;
  service: string;
  servicePrice: number;
  addons: { name: string; price: number }[];
  tipAmount: number;
  total: number;
  address: string;
}): string {
  const addonRows = data.addons
    .map(
      (a) => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#555555;border-bottom:1px solid #f0ebe5;">
        ${a.name}
      </td>
      <td style="padding:8px 0;font-size:14px;color:#555555;text-align:right;border-bottom:1px solid #f0ebe5;">
        $${a.price.toFixed(2)}
      </td>
    </tr>`
    )
    .join("");

  const tipRow =
    data.tipAmount > 0
      ? `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#555555;border-bottom:1px solid #f0ebe5;">
        Tip
      </td>
      <td style="padding:8px 0;font-size:14px;color:#555555;text-align:right;border-bottom:1px solid #f0ebe5;">
        $${data.tipAmount.toFixed(2)}
      </td>
    </tr>`
      : "";

  return emailLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;color:#333333;">Your car wash is booked! &#x1F920;</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#555555;">
      Hey ${data.customerName}! Thanks for booking with Keep Austin Scrubbin'. Here are your details:
    </p>

    <!-- Booking Details Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF5F0;border-radius:8px;border:1px solid #E8D5C0;margin-bottom:24px;">
    <tr><td style="padding:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 0 12px;font-size:14px;color:#6B5D50;">&#x1F4C5; <strong>Date</strong></td>
          <td style="padding:0 0 12px;font-size:14px;color:#333333;text-align:right;">${data.date}</td>
        </tr>
        <tr>
          <td style="padding:0 0 12px;font-size:14px;color:#6B5D50;">&#x23F0; <strong>Time</strong></td>
          <td style="padding:0 0 12px;font-size:14px;color:#333333;text-align:right;">${data.time}</td>
        </tr>
        <tr>
          <td style="padding:0 0 12px;font-size:14px;color:#6B5D50;">&#x1F697; <strong>Service</strong></td>
          <td style="padding:0 0 12px;font-size:14px;color:#333333;text-align:right;">${data.service}</td>
        </tr>
        <tr>
          <td style="padding:0;font-size:14px;color:#6B5D50;">&#x1F4CD; <strong>Location</strong></td>
          <td style="padding:0;font-size:14px;color:#333333;text-align:right;">${data.address}</td>
        </tr>
      </table>
    </td></tr>
    </table>

    <!-- Receipt -->
    <h2 style="margin:0 0 12px;font-size:18px;color:#333333;">Receipt</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#555555;border-bottom:1px solid #f0ebe5;">
          ${data.service}
        </td>
        <td style="padding:8px 0;font-size:14px;color:#555555;text-align:right;border-bottom:1px solid #f0ebe5;">
          $${data.servicePrice.toFixed(2)}
        </td>
      </tr>
      ${addonRows}
      ${tipRow}
      <tr>
        <td style="padding:12px 0 0;font-size:16px;color:#333333;font-weight:bold;">
          Total
        </td>
        <td style="padding:12px 0 0;font-size:16px;color:#E06030;text-align:right;font-weight:bold;">
          $${data.total.toFixed(2)}
        </td>
      </tr>
    </table>

    <!-- What to Expect -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf8f4;border-radius:8px;border-left:4px solid #E06030;">
    <tr><td style="padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#333333;">What to expect</p>
      <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#555555;line-height:1.6;">
        <li>Park your car in an accessible spot</li>
        <li>We bring all equipment and water — no hookups needed</li>
        <li>We'll text you when we're on the way and when we're done</li>
      </ul>
    </td></tr>
    </table>
  `);
}

// ---- Day-Of Reminder Email ----

export function dayOfReminderEmail(data: {
  customerName: string;
  time: string;
  service: string;
  address: string;
}): string {
  return emailLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;color:#333333;">Car wash day! &#x1F9FD;</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#555555;">
      Hey ${data.customerName}! Just a friendly reminder — we're coming to wash your ride today.
    </p>

    <!-- Appointment Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF5F0;border-radius:8px;border:1px solid #E8D5C0;margin-bottom:24px;">
    <tr><td style="padding:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 0 12px;font-size:14px;color:#6B5D50;">&#x23F0; <strong>Time</strong></td>
          <td style="padding:0 0 12px;font-size:16px;color:#333333;text-align:right;font-weight:bold;">${data.time}</td>
        </tr>
        <tr>
          <td style="padding:0 0 12px;font-size:14px;color:#6B5D50;">&#x1F697; <strong>Service</strong></td>
          <td style="padding:0 0 12px;font-size:14px;color:#333333;text-align:right;">${data.service}</td>
        </tr>
        <tr>
          <td style="padding:0;font-size:14px;color:#6B5D50;">&#x1F4CD; <strong>Location</strong></td>
          <td style="padding:0;font-size:14px;color:#333333;text-align:right;">${data.address}</td>
        </tr>
      </table>
    </td></tr>
    </table>

    <!-- Prep Checklist -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf8f4;border-radius:8px;border-left:4px solid #E06030;">
    <tr><td style="padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#333333;">Quick prep checklist</p>
      <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#555555;line-height:1.6;">
        <li>Park your car in a spot we can access easily</li>
        <li>No need to be home — just leave the car accessible</li>
        <li>We bring everything (water, supplies, the works)</li>
        <li>We'll text you when we arrive and when we're done</li>
      </ul>
    </td></tr>
    </table>

    <p style="margin:24px 0 0;font-size:14px;color:#555555;">
      Need to reschedule or have questions? Just reply to this email and we'll get you sorted.
    </p>
  `);
}
