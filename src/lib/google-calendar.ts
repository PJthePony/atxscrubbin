import { google, calendar_v3 } from "googleapis";

// -- Singleton client --

let calendarClient: calendar_v3.Calendar | null = null;
let initAttempted = false;

function getCalendar(): calendar_v3.Calendar | null {
  if (calendarClient) return calendarClient;
  if (initAttempted) return null;
  initAttempted = true;

  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    console.warn("[Google Calendar] Missing GOOGLE_CALENDAR_CLIENT_EMAIL or GOOGLE_CALENDAR_PRIVATE_KEY — calendar sync disabled");
    return null;
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  calendarClient = google.calendar({ version: "v3", auth });
  return calendarClient;
}

const CALENDAR_ID = () =>
  process.env.GOOGLE_CALENDAR_ID || "keepaustinscrubbin@gmail.com";

const TIMEZONE = "America/Chicago";

// -- Color IDs (Google Calendar palette) --
const COLOR = {
  availability: "2",   // Sage green
  confirmed: "9",      // Blueberry
  in_progress: "6",    // Tangerine
  completed: "10",     // Basil (dark green)
} as const;

function bookingColor(status: string): string {
  return COLOR[status as keyof typeof COLOR] || COLOR.confirmed;
}

// -- Availability events --

interface AvailabilityParams {
  teamMemberName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  existingEventId?: string | null;
}

export async function syncAvailabilityEvent(
  params: AvailabilityParams
): Promise<string | null> {
  const cal = getCalendar();
  if (!cal) return null;

  const { teamMemberName, date, startTime, endTime, existingEventId } = params;

  const event: calendar_v3.Schema$Event = {
    summary: `${teamMemberName} Available`,
    description: "Team member available for bookings",
    start: { dateTime: `${date}T${startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${date}T${endTime}:00`, timeZone: TIMEZONE },
    colorId: COLOR.availability,
  };

  try {
    if (existingEventId) {
      const res = await cal.events.update({
        calendarId: CALENDAR_ID(),
        eventId: existingEventId,
        requestBody: event,
      });
      return res.data.id || existingEventId;
    } else {
      const res = await cal.events.insert({
        calendarId: CALENDAR_ID(),
        requestBody: event,
      });
      return res.data.id || null;
    }
  } catch (err) {
    console.error("[Google Calendar] syncAvailabilityEvent failed:", err);
    return null;
  }
}

// -- Booking events --

interface BookingEventParams {
  status: string;
  customerName: string;
  carSizeName: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  address: string;
  total?: number;
  notes?: string | null;
  addonNames?: string[];
  existingEventId?: string | null;
}

export async function syncBookingEvent(
  params: BookingEventParams
): Promise<string | null> {
  const cal = getCalendar();
  if (!cal) return null;

  const {
    status,
    customerName,
    carSizeName,
    date,
    startTime,
    endTime,
    address,
    total,
    notes,
    addonNames,
    existingEventId,
  } = params;

  // Build description
  const lines: string[] = [
    `Customer: ${customerName}`,
    `Service: ${carSizeName}`,
  ];
  if (addonNames && addonNames.length > 0) {
    lines.push(`Add-ons: ${addonNames.join(", ")}`);
  }
  if (total !== undefined) {
    lines.push(`Total: $${total.toFixed(2)}`);
  }
  if (notes) {
    lines.push(`Notes: ${notes}`);
  }
  lines.push(`Status: ${status}`);

  const event: calendar_v3.Schema$Event = {
    summary: `${customerName} — ${carSizeName}`,
    description: lines.join("\n"),
    location: address,
    start: { dateTime: `${date}T${startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${date}T${endTime}:00`, timeZone: TIMEZONE },
    colorId: bookingColor(status),
  };

  try {
    if (existingEventId) {
      const res = await cal.events.update({
        calendarId: CALENDAR_ID(),
        eventId: existingEventId,
        requestBody: event,
      });
      return res.data.id || existingEventId;
    } else {
      const res = await cal.events.insert({
        calendarId: CALENDAR_ID(),
        requestBody: event,
      });
      return res.data.id || null;
    }
  } catch (err) {
    console.error("[Google Calendar] syncBookingEvent failed:", err);
    return null;
  }
}

// -- Delete event --

export async function deleteCalendarEvent(
  eventId: string
): Promise<void> {
  const cal = getCalendar();
  if (!cal) return;

  try {
    await cal.events.delete({
      calendarId: CALENDAR_ID(),
      eventId,
    });
  } catch (err) {
    console.error("[Google Calendar] deleteCalendarEvent failed:", err);
  }
}
