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
  total: number;
  status: string;
  customer: {
    full_name: string;
    phone: string;
  } | null;
  car_size: {
    name: string;
  } | null;
  booking_addons: {
    addon: { name: string };
  }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: "Up Next", color: "text-blue-400", bg: "bg-blue-500/20" },
  in_progress: { label: "In Progress", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  completed: { label: "Done", color: "text-green-400", bg: "bg-green-500/20" },
  cancelled: { label: "Cancelled", color: "text-zinc-500", bg: "bg-zinc-700/50" },
};

export default function TodayPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState<Record<string, Record<string, boolean>>>({});

  const today = new Date().toISOString().split("T")[0];

  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/bookings?date=${today}`);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadBookings();
    // Refresh every 30 seconds
    const interval = setInterval(loadBookings, 30000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadBookings();
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const active = bookings.filter((b) => b.status !== "cancelled" && b.status !== "refunded");
  const completed = active.filter((b) => b.status === "completed");
  const remaining = active.filter((b) => b.status !== "completed");
  const totalRevenue = active.reduce((sum, b) => sum + b.total, 0);

  if (loading) {
    return (
      <div className="text-center py-12 text-zinc-500">Loading today&apos;s schedule...</div>
    );
  }

  return (
    <div>
      {/* Header with stats */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Today&apos;s Schedule</h1>
        <p className="text-sm text-zinc-400">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-2xl font-bold">{active.length}</p>
          <p className="text-xs text-zinc-500">Washes</p>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">
            {completed.length}/{active.length}
          </p>
          <p className="text-xs text-zinc-500">Done</p>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-2xl font-bold text-orange">${totalRevenue}</p>
          <p className="text-xs text-zinc-500">Revenue</p>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <div className="text-4xl mb-3">😎</div>
          <p className="text-zinc-400">No washes today. Enjoy the day off!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Remaining jobs first, then completed */}
          {[...remaining, ...completed].map((booking) => {
            const statusInfo = STATUS_LABELS[booking.status] || STATUS_LABELS.confirmed;
            const isCompleted = booking.status === "completed";

            return (
              <div
                key={booking.id}
                className={`rounded-xl border overflow-hidden ${
                  isCompleted
                    ? "border-zinc-800/50 bg-zinc-900/30 opacity-60"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                {/* Time & status bar */}
                <div className={`px-4 py-2 flex items-center justify-between ${statusInfo.bg}`}>
                  <span className={`text-sm font-bold ${statusInfo.color}`}>
                    {formatTime(booking.scheduled_start)} &ndash;{" "}
                    {formatTime(booking.scheduled_end)}
                  </span>
                  <span className={`text-xs font-semibold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="px-4 py-4">
                  {/* Customer & service */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">
                        {booking.customer?.full_name}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {booking.car_size?.name}
                        {booking.booking_addons.length > 0 &&
                          ` + ${booking.booking_addons.map((ba) => ba.addon.name).join(", ")}`}
                      </p>
                    </div>
                    <p className="text-xl font-bold">${booking.total}</p>
                  </div>

                  {/* Address with tap-to-navigate */}
                  <a
                    href={`https://maps.apple.com/?q=${encodeURIComponent(booking.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg bg-zinc-800 px-3 py-2 mb-3 text-sm text-blue-400 hover:text-blue-300 transition"
                  >
                    📍 {booking.address}
                  </a>

                  {/* Phone */}
                  {booking.customer?.phone && (
                    <a
                      href={`tel:${booking.customer.phone}`}
                      className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition mb-3"
                    >
                      📱 {booking.customer.phone}
                    </a>
                  )}

                  {/* Notes */}
                  {booking.notes && (
                    <div className="rounded-lg bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 mb-3">
                      📝 {booking.notes}
                    </div>
                  )}

                  {/* Action buttons & checklist */}
                  <div>
                    {booking.status === "confirmed" && (
                      <button
                        onClick={() => {
                          const items: Record<string, boolean> = {
                            "Exterior wash": false,
                            "Tire scrub": false,
                          };
                          booking.booking_addons.forEach((ba) => {
                            items[ba.addon.name] = false;
                          });
                          setChecklists((prev) => ({ ...prev, [booking.id]: items }));
                          updateStatus(booking.id, "in_progress");
                        }}
                        className="w-full rounded-xl bg-yellow-600 py-3.5 text-base font-bold text-white hover:bg-yellow-500 active:scale-[0.98] transition"
                      >
                        Start Wash
                      </button>
                    )}
                    {booking.status === "in_progress" && (() => {
                      const items = checklists[booking.id];
                      const allChecked = items ? Object.values(items).every(Boolean) : false;

                      return (
                        <div className="space-y-3">
                          {/* Checklist */}
                          {items && (
                            <div className="rounded-xl border border-zinc-700 bg-zinc-800/60 overflow-hidden">
                              <p className="px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide border-b border-zinc-700">
                                Wash Checklist
                              </p>
                              {Object.entries(items).map(([name, checked], i) => {
                                const isAddon = name !== "Exterior wash" && name !== "Tire scrub";
                                return (
                                  <button
                                    key={name}
                                    onClick={() =>
                                      setChecklists((prev) => ({
                                        ...prev,
                                        [booking.id]: {
                                          ...prev[booking.id],
                                          [name]: !checked,
                                        },
                                      }))
                                    }
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-700/40 active:bg-zinc-700/60 ${
                                      i > 0 ? "border-t border-zinc-700/50" : ""
                                    }`}
                                  >
                                    <span
                                      className={`flex items-center justify-center w-6 h-6 rounded-lg border-2 shrink-0 transition ${
                                        checked
                                          ? "bg-green-500 border-green-500 text-white"
                                          : "border-zinc-500 text-transparent"
                                      }`}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </span>
                                    <span className={`text-sm ${checked ? "text-zinc-500 line-through" : "text-white"}`}>
                                      {isAddon && (
                                        <span className="text-orange text-xs font-semibold mr-1.5">ADD-ON</span>
                                      )}
                                      {name}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <button
                            onClick={() => updateStatus(booking.id, "completed")}
                            disabled={!allChecked}
                            className={`w-full rounded-xl py-3.5 text-base font-bold text-white active:scale-[0.98] transition ${
                              allChecked
                                ? "bg-green-600 hover:bg-green-500"
                                : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                            }`}
                          >
                            {allChecked ? "Mark Done" : "Complete checklist to finish"}
                          </button>
                        </div>
                      );
                    })()}
                    {booking.status === "completed" && (
                      <div className="text-center py-3.5 text-base text-green-400 font-semibold">
                        Completed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
