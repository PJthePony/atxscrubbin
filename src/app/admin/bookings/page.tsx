"use client";

import { useEffect, useState, useCallback } from "react";

interface BookingRow {
  id: string;
  scheduled_date: string;
  scheduled_start: string;
  scheduled_end: string;
  estimated_duration_minutes: number;
  address: string;
  notes: string | null;
  subtotal: number;
  total: number;
  status: string;
  stripe_payment_intent_id: string | null;
  created_at: string;
  customer: {
    full_name: string;
    email: string;
    phone: string;
  } | null;
  car_size: {
    name: string;
    base_price: number;
  } | null;
  booking_addons: {
    addon: { name: string };
    price_at_booking: number;
  }[];
  booking_team_members: {
    team_member: { display_name: string };
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-zinc-100 text-zinc-600",
};

const STATUS_OPTIONS = ["confirmed", "in_progress", "completed", "cancelled"];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [textingId, setTextingId] = useState<string | null>(null);
  const [textMessage, setTextMessage] = useState("");
  const [textSending, setTextSending] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (dateFilter) params.set("date", dateFilter);

    try {
      const res = await fetch(`/api/admin/bookings?${params}`);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadBookings();
  };

  const sendText = async (bookingId: string) => {
    if (!textMessage.trim()) return;
    setTextSending(true);
    const res = await fetch("/api/admin/bookings/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, message: textMessage }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to send text");
    } else {
      alert("Text sent!");
      setTextMessage("");
      setTextingId(null);
    }
    setTextSending(false);
  };

  const refundBooking = async (id: string) => {
    if (!confirm("Issue a full refund for this booking?")) return;
    const res = await fetch("/api/admin/bookings/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: id }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Refund failed");
      return;
    }
    loadBookings();
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-zinc-400">
            All bookings, past and upcoming
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-xs text-zinc-500 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-center py-12">Loading...</p>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-500">
          No bookings found.{" "}
          {(statusFilter || dateFilter) &&
            "Try adjusting your filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const expanded = expandedId === booking.id;
            return (
              <div
                key={booking.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
              >
                {/* Summary row */}
                <button
                  onClick={() =>
                    setExpandedId(expanded ? null : booking.id)
                  }
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-zinc-800/50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold truncate">
                        {booking.customer?.full_name || "Unknown"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          STATUS_COLORS[booking.status] || "bg-zinc-700 text-zinc-300"
                        }`}
                      >
                        {booking.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">
                      {formatDate(booking.scheduled_date)} &middot;{" "}
                      {formatTime(booking.scheduled_start)} &ndash;{" "}
                      {formatTime(booking.scheduled_end)} &middot;{" "}
                      {booking.car_size?.name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-lg">${booking.total}</p>
                    <p className="text-xs text-zinc-500">
                      ~{booking.estimated_duration_minutes} min
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-zinc-500 shrink-0 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500 mb-1">Customer</p>
                        <p className="font-semibold">
                          {booking.customer?.full_name}
                        </p>
                        <p className="text-zinc-400">
                          {booking.customer?.email}
                        </p>
                        <p className="text-zinc-400">
                          {booking.customer?.phone}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500 mb-1">Address</p>
                        <p>{booking.address}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 mb-1">Service</p>
                        <p className="font-semibold">
                          {booking.car_size?.name} — $
                          {booking.car_size?.base_price}
                        </p>
                        {booking.booking_addons.length > 0 && (
                          <div className="mt-1">
                            {booking.booking_addons.map((ba, i) => (
                              <p key={i} className="text-zinc-400">
                                + {ba.addon.name} — ${ba.price_at_booking}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-zinc-500 mb-1">Team</p>
                        {booking.booking_team_members.length > 0 ? (
                          booking.booking_team_members.map((btm, i) => (
                            <p key={i}>
                              {btm.team_member.display_name}
                            </p>
                          ))
                        ) : (
                          <p className="text-zinc-500">Not assigned</p>
                        )}
                      </div>
                    </div>

                    {booking.notes && (
                      <div className="text-sm">
                        <p className="text-zinc-500 mb-1">Notes</p>
                        <p className="bg-zinc-800 rounded-lg px-3 py-2">
                          {booking.notes}
                        </p>
                      </div>
                    )}

                    {/* Text customer */}
                    <div className="pt-2 border-t border-zinc-800">
                      {textingId === booking.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={textMessage}
                            onChange={(e) => setTextMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder:text-zinc-500"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") sendText(booking.id);
                            }}
                          />
                          <button
                            onClick={() => sendText(booking.id)}
                            disabled={textSending || !textMessage.trim()}
                            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-40"
                          >
                            {textSending ? "..." : "Send"}
                          </button>
                          <button
                            onClick={() => {
                              setTextingId(null);
                              setTextMessage("");
                            }}
                            className="text-sm text-zinc-500 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setTextingId(booking.id)}
                          className="text-sm text-blue-400 hover:text-blue-300 transition"
                        >
                          💬 Text Customer
                        </button>
                      )}
                    </div>

                    {/* Status workflow */}
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <span className="text-sm text-zinc-500 mr-2">
                        Update status:
                      </span>
                      {booking.status === "confirmed" && (
                        <button
                          onClick={() =>
                            updateStatus(booking.id, "in_progress")
                          }
                          className="rounded-lg bg-yellow-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-yellow-500 transition"
                        >
                          Start Wash
                        </button>
                      )}
                      {booking.status === "in_progress" && (
                        <button
                          onClick={() =>
                            updateStatus(booking.id, "completed")
                          }
                          className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-500 transition"
                        >
                          Mark Complete
                        </button>
                      )}
                      {(booking.status === "confirmed" ||
                        booking.status === "in_progress") && (
                        <button
                          onClick={() =>
                            updateStatus(booking.id, "cancelled")
                          }
                          className="rounded-lg bg-zinc-700 px-4 py-1.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-600 transition"
                        >
                          Cancel
                        </button>
                      )}
                      {booking.status === "completed" && (
                        <>
                          <span className="text-sm text-green-400">
                            Done!
                          </span>
                          {booking.stripe_payment_intent_id && (
                            <button
                              onClick={() => refundBooking(booking.id)}
                              className="rounded-lg bg-red-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 transition"
                            >
                              Refund
                            </button>
                          )}
                        </>
                      )}
                      {booking.status === "cancelled" && (
                        <>
                          <span className="text-sm text-zinc-500">
                            Cancelled
                          </span>
                          {booking.stripe_payment_intent_id && (
                            <button
                              onClick={() => refundBooking(booking.id)}
                              className="rounded-lg bg-red-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 transition"
                            >
                              Refund
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
