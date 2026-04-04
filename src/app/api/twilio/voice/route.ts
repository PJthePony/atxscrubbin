import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VOICEMAIL_GREETING = `Hey! You've reached Keep Austin Scrubbin, Austin's mobile car wash. We can't take your call right now, but leave us a message and we'll get back to you. You can also book online at a t x scrubbin dot com. Thanks!`;

export async function POST() {
  // Determine the base URL for the transcription callback
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.atxscrubbin.com";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="man">${VOICEMAIL_GREETING}</Say>
  <Record maxLength="120" transcribe="true" transcribeCallback="${baseUrl}/api/twilio/voicemail" playBeep="true" />
  <Say voice="man">Thanks for your message! We'll get back to you soon.</Say>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
