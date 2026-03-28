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
    id: string;
    name: string;
    base_price: number;
  } | null;
  booking_addons: {
    addon: { id: string; name: string };
    price_at_booking: number;
  }[];
  booking_team_members: {
    team_member: { display_name: string };
  }[];
}

interface CarSizeOption {
  id: string;
  name: string;
  base_price: number;
  wash_time_minutes: number;
}

interface AddonOption {
  id: string;
  name: string;
  price: number;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-zinc-100 text-zinc-600",
};

const STATUS_OPTIONS = ["confirmed", "in_progress", "completed", "cancelled"];

interface BookingForm {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  car_size_id: string;
  addon_ids: string[];
  address: string;
  scheduled_date: string;
  scheduled_start: string;
  notes: string;
}

const EMPTY_FORM: BookingForm = {
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  car_size_id: "",
  addon_ids: [],
  address: "",
  scheduled_date: "",
  scheduled_start: "",
  notes: "",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [textingId, setTextingId] = useState<string | null>(null);
  const [textMessage, setTextMessage] = useState("");
  const [textSending, setTextSending] = useState(false);

  // Modal state — shared for create and edit
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [form, setForm] = useState<BookingForm>(EMPTY_FORM);
  const [carSizes, setCarSizes] = useState<CarSizeOption[]>([]);
  const [addons, setAddons] = useState<AddonOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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

  // Load car sizes and addons when modal opens
  useEffect(() => {
    if (!modalMode) return;
    fetch("/api/booking/services")
      .then((r) => r.json())
      .then((data) => {
        setCarSizes(data.car_sizes || []);
        setAddons(data.addons || []);
      });
  }, [modalMode]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setEditingBookingId(null);
    setFormError("");
    setModalMode("create");
  };

  const openEditModal = (booking: BookingRow) => {
    setForm({
      customer_name: booking.customer?.full_name || "",
      customer_email: booking.customer?.email || "",
      customer_phone: booking.customer?.phone || "",
      car_size_id: booking.car_size?.id || "",
      addon_ids: booking.booking_addons.map((ba) => ba.addon.id),
      address: booking.address,
      scheduled_date: booking.scheduled_date,
      scheduled_start: booking.scheduled_start.slice(0, 5), // HH:MM
      notes: booking.notes || "",
    });
    setEditingBookingId(booking.id);
    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingBookingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

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

  const deleteBooking = async (id: string) => {
    if (!confirm("Permanently delete this booking? This cannot be undone."))
      return;
    const res = await fetch(`/api/admin/bookings?id=${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }
    setExpandedId(null);
    loadBookings();
  };

  const handleSave = async () => {
    setFormError("");
    if (
      !form.customer_name ||
      !form.customer_email ||
      !form.customer_phone ||
      !form.car_size_id ||
      !form.address ||
      !form.scheduled_date ||
      !form.scheduled_start
    ) {
      setFormError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        const res = await fetch("/api/admin/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Failed to create booking");
          return;
        }
      } else if (modalMode === "edit" && editingBookingId) {
        const res = await fetch("/api/admin/bookings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingBookingId, ...form }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Failed to update booking");
          return;
        }
      }
      closeModal();
      loadBookings();
    } catch {
      setFormError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const toggleAddon = (id: string) => {
    setForm((prev) => ({
      ...prev,
      addon_ids: prev.addon_ids.includes(id)
        ? prev.addon_ids.filter((a) => a !== id)
        : [...prev.addon_ids, id],
    }));
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
        <div className="flex flex-wrap gap-3">
          <button
            onClick={openCreateModal}
            className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 active:scale-[0.98] transition min-h-[44px]"
          >
            + New Booking
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white min-h-[44px]"
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
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white min-h-[44px]"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-sm text-zinc-400 hover:text-white py-2 px-2 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Create / Edit Booking Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">
                {modalMode === "create" ? "New Booking" : "Edit Booking"}
              </h2>
              <button
                onClick={closeModal}
                className="text-zinc-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {/* Customer info */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customer_name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        customer_email: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={form.customer_phone}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        customer_phone: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, address: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white"
                />
              </div>

              {/* Car size */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Car Size *
                </label>
                <select
                  value={form.car_size_id}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, car_size_id: e.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white"
                >
                  <option value="">Select...</option>
                  {carSizes.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.name} — ${cs.base_price}
                    </option>
                  ))}
                </select>
              </div>

              {/* Addons */}
              {addons.length > 0 && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">
                    Add-ons
                  </label>
                  <div className="space-y-2">
                    {addons.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.addon_ids.includes(a.id)}
                          onChange={() => toggleAddon(a.id)}
                          className="rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm">
                          {a.name}{" "}
                          <span className="text-zinc-400">— ${a.price}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Date & time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        scheduled_date: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={form.scheduled_start}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        scheduled_start: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 active:scale-[0.98] transition disabled:opacity-40"
                >
                  {saving
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Create Booking"
                    : "Save Changes"}
                </button>
                <button
                  onClick={closeModal}
                  className="rounded-lg bg-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 text-center py-12">Loading...</p>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-500">
          No bookings found.{" "}
          {(statusFilter || dateFilter) && "Try adjusting your filters."}
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
                          STATUS_COLORS[booking.status] ||
                          "bg-zinc-700 text-zinc-300"
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
                            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") sendText(booking.id);
                            }}
                          />
                          <button
                            onClick={() => sendText(booking.id)}
                            disabled={textSending || !textMessage.trim()}
                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-40"
                          >
                            {textSending ? "..." : "Send"}
                          </button>
                          <button
                            onClick={() => {
                              setTextingId(null);
                              setTextMessage("");
                            }}
                            className="text-sm text-zinc-400 hover:text-white py-2 px-2 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setTextingId(booking.id)}
                          className="text-sm text-blue-400 hover:text-blue-300 py-2 transition"
                        >
                          Text Customer
                        </button>
                      )}
                    </div>

                    {/* Status workflow */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
                      <span className="text-sm text-zinc-500 mr-1">
                        Status:
                      </span>
                      {booking.status === "confirmed" && (
                        <button
                          onClick={() =>
                            updateStatus(booking.id, "in_progress")
                          }
                          className="rounded-lg bg-yellow-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-yellow-500 active:scale-[0.98] transition"
                        >
                          Start Wash
                        </button>
                      )}
                      {booking.status === "in_progress" && (
                        <button
                          onClick={() =>
                            updateStatus(booking.id, "completed")
                          }
                          className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 active:scale-[0.98] transition"
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
                          className="rounded-lg bg-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-600 active:scale-[0.98] transition"
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
                              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 active:scale-[0.98] transition"
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
                              className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 active:scale-[0.98] transition"
                            >
                              Refund
                            </button>
                          )}
                        </>
                      )}

                      {/* Edit & Delete — always available */}
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => openEditModal(booking)}
                          className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 active:scale-[0.98] transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteBooking(booking.id)}
                          className="rounded-lg border border-red-800 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-900/30 active:scale-[0.98] transition"
                        >
                          Delete
                        </button>
                      </div>
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
