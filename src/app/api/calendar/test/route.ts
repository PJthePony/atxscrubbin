import { NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "keepaustinscrubbin@gmail.com";

  if (!clientEmail || !privateKey) {
    return NextResponse.json({ error: "Missing env vars", clientEmail: !!clientEmail, privateKey: !!privateKey });
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    // Try to create a test event
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: "🧪 Calendar Sync Test",
        description: "Test event — safe to delete",
        start: { dateTime: new Date(Date.now() + 60000).toISOString(), timeZone: "America/Chicago" },
        end: { dateTime: new Date(Date.now() + 120000).toISOString(), timeZone: "America/Chicago" },
      },
    });

    return NextResponse.json({ success: true, eventId: res.data.id, htmlLink: res.data.htmlLink });
  } catch (err: unknown) {
    const error = err as { message?: string; code?: number; errors?: unknown };
    return NextResponse.json({
      error: error.message,
      code: error.code,
      details: error.errors,
    }, { status: 500 });
  }
}
