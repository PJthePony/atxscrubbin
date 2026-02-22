import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { withAdmin } from "@/lib/admin-guard";
import { sendSMS } from "@/lib/twilio";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withAdmin(async () => {
    const { booking_id, message } = await request.json();

    if (!booking_id || !message) {
      return NextResponse.json(
        { error: "booking_id and message are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: booking } = await supabase
      .from("bookings")
      .select("customer:customers(phone, full_name)")
      .eq("id", booking_id)
      .single();

    const customer = booking?.customer as unknown as { phone: string; full_name: string } | null;
    if (!customer?.phone) {
      return NextResponse.json(
        { error: "Customer has no phone number" },
        { status: 400 }
      );
    }

    const sid = await sendSMS(customer.phone, message);

    if (!sid) {
      return NextResponse.json(
        { error: "Failed to send text" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message_sid: sid });
  });
}
