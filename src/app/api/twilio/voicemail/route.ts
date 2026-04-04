import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const transcriptionText = (formData.get("TranscriptionText") as string) || "(no transcription available)";
  const recordingUrl = (formData.get("RecordingUrl") as string) || "";
  const from = (formData.get("From") as string) || "Unknown";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#E06030;margin-bottom:16px;">New Voicemail</h2>
      <p><strong>From:</strong> ${from}</p>
      <p><strong>Transcription:</strong></p>
      <blockquote style="border-left:3px solid #E06030;padding:8px 16px;margin:12px 0;color:#555;background:#FAF5F0;border-radius:4px;">
        ${transcriptionText}
      </blockquote>
      ${recordingUrl ? `<p><a href="${recordingUrl}" style="color:#E06030;">Listen to recording</a></p>` : ""}
      <hr style="border:none;border-top:1px solid #E8D5C0;margin:24px 0;">
      <p style="font-size:13px;color:#999;">This voicemail was left on the Keep Austin Scrubbin' phone line.</p>
    </div>
  `;

  await sendEmail(
    "keep.austin.scrubbin@gmail.com",
    `Voicemail from ${from}`,
    html
  );

  return NextResponse.json({ ok: true });
}
