import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const duration = searchParams.get("duration");

  if (!date || !duration) {
    return NextResponse.json(
      { error: "date and duration are required" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Don't allow booking in the past
  const today = new Date().toISOString().split("T")[0];
  if (date < today) {
    return NextResponse.json(
      { error: "Cannot book in the past" },
      { status: 400 }
    );
  }

  const durationMinutes = parseInt(duration, 10);
  if (isNaN(durationMinutes) || durationMinutes < 1) {
    return NextResponse.json(
      { error: "duration must be a positive number" },
      { status: 400 }
    );
  }

  try {
    const slots = await getAvailableSlots(date, durationMinutes);
    return NextResponse.json({ slots });
  } catch {
    return NextResponse.json(
      { error: "Failed to calculate slots" },
      { status: 500 }
    );
  }
}
