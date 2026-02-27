"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

interface CarSize {
  id: string;
  name: string;
  base_price: number;
  wash_time_minutes: number;
}

interface BookingAddon {
  addon: { id: string; name: string; price: number };
  price_at_booking: number;
}

interface BookingData {
  id: string;
  car_size_id: string;
  scheduled_date: string;
  scheduled_start: string;
  scheduled_end: string;
  estimated_duration_minutes: number;
  address: string;
  notes: string | null;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
  car_size: CarSize;
  booking_addons: BookingAddon[];
}

interface CustomerData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
}

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState("");

  const doLookup = useCallback(async (lookupEmail: string) => {
    setLoading(true);
    setError("");
    setCancelMessage("");

    try {
      const res = await fetch(
        `/api/account/bookings?email=${encodeURIComponent(lookupEmail.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setCustomer(null);
        setBookings([]);
        return;
      }

      setCustomer(data.customer);
      setBookings(data.bookings);
      sessionStorage.setItem("account_email", lookupEmail.trim());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("account_email");
    if (saved) {
      setEmail(saved);
      doLookup(saved);
    }
  }, [doLookup]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    doLookup(email);
  };

  const handleCancel = async (bookingId: string) => {
    if (
      !confirm(
        "Are you sure you want to cancel this booking? You'll receive a full refund."
      )
    )
      return;

    setCancellingId(bookingId);
    setCancelMessage("");

    try {
      const res = await fetch("/api/account/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          customer_email: customer?.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCancelMessage(data.error || "Cancel failed");
        return;
      }

      setCancelMessage(data.message);

      // Refresh bookings
      const refreshRes = await fetch(
        `/api/account/bookings?email=${encodeURIComponent(email.trim())}`
      );
      const refreshData = await refreshRes.json();
      if (refreshRes.ok) {
        setBookings(refreshData.bookings);
      }
    } catch {
      setCancelMessage("Something went wrong. Please try again.");
    } finally {
      setCancellingId(null);
    }
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

  const formatDateLong = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
            Confirmed
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
            In Progress
          </span>
        );
      case "completed":
        return (
          <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-brown/10 text-brown/60">
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
            Cancelled
          </span>
        );
      case "refunded":
        return (
          <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-orange/10 text-orange-dark">
            Refunded
          </span>
        );
      default:
        return null;
    }
  };

  const isUpcoming = (booking: BookingData) => {
    const now = new Date();
    const bookingDate = new Date(
      `${booking.scheduled_date}T${booking.scheduled_start}`
    );
    return (
      bookingDate > now &&
      (booking.status === "confirmed" || booking.status === "in_progress")
    );
  };

  const isCancellable = (booking: BookingData) => {
    if (booking.status !== "confirmed") return false;
    const now = new Date();
    const bookingDate = new Date(
      `${booking.scheduled_date}T${booking.scheduled_start}`
    );
    const hoursUntil =
      (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil >= 24;
  };

  const upcomingBookings = bookings.filter(isUpcoming);
  const pastBookings = bookings.filter((b) => !isUpcoming(b));

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-3 max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/nav-icon.png"
              alt="ATX Scrubbin'"
              width={36}
              height={36}
              className="rounded-full"
            />
            <span className="text-2xl font-bold tracking-tight text-white">
              ATX <span className="text-orange">Scrubbin&apos;</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-base text-white/60 hover:text-white transition"
            >
              Home
            </Link>
            <Link
              href="/book"
              className="rounded-full bg-orange px-6 py-2.5 text-base font-bold text-black transition hover:bg-orange-dark"
            >
              Book a Wash
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Title */}
        <h1 className="text-3xl font-bold text-brown-dark mb-2">
          Your Washes
        </h1>
        <p className="text-brown/60 mb-8">
          Look up your past and upcoming washes.
        </p>

        {/* Email Lookup */}
        {!customer && (
          <form onSubmit={handleLookup} className="mb-8">
            <label className="block text-base font-bold text-brown-dark mb-2">
              Enter your email to find your bookings
            </label>
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 rounded-xl border-2 border-brown/10 bg-white px-4 py-3 text-brown-dark placeholder:text-brown/30 focus:border-orange focus:outline-none transition"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-orange px-6 py-3 font-bold text-white transition hover:bg-orange-dark disabled:opacity-50"
              >
                {loading ? "Looking..." : "Look Up"}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-red-600 text-base">{error}</p>
            )}
          </form>
        )}

        {/* Customer Header */}
        {customer && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xl font-bold text-brown-dark">
                  Hey, {customer.full_name.split(" ")[0]}!
                </p>
                <p className="text-base text-brown/60">{customer.email}</p>
              </div>
              <button
                onClick={() => {
                  setCustomer(null);
                  setBookings([]);
                  setEmail("");
                  setCancelMessage("");
                  sessionStorage.removeItem("account_email");
                }}
                className="text-base text-brown/50 hover:text-brown-dark transition"
              >
                Sign Out
              </button>
            </div>

            {cancelMessage && (
              <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-base">
                {cancelMessage}
              </div>
            )}

            {bookings.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🧽</div>
                <h2 className="text-xl font-bold text-brown-dark mb-2">
                  No washes yet!
                </h2>
                <p className="text-brown/60 mb-6">
                  Book your first wash and we&apos;ll take it from there.
                </p>
                <Link
                  href="/book"
                  className="inline-block rounded-full bg-orange px-8 py-3.5 font-bold text-white transition hover:bg-orange-dark active:scale-[0.98]"
                >
                  Book a Wash
                </Link>
              </div>
            ) : (
              <>
                {/* Upcoming Bookings */}
                {upcomingBookings.length > 0 && (
                  <div className="mb-10">
                    <h2 className="text-xl font-bold text-brown-dark mb-4">
                      Upcoming
                    </h2>
                    <div className="space-y-4">
                      {upcomingBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="rounded-2xl border-2 border-orange/20 bg-white p-6"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-lg font-bold text-brown-dark">
                                {formatDateLong(booking.scheduled_date)}
                              </p>
                              <p className="text-base text-brown/60">
                                {formatTime(booking.scheduled_start)} &ndash;{" "}
                                {formatTime(booking.scheduled_end)}
                              </p>
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-base text-brown-dark">
                                {booking.car_size?.name} Wash
                                {booking.booking_addons?.length > 0 &&
                                  ` + ${booking.booking_addons.length} add-on${booking.booking_addons.length > 1 ? "s" : ""}`}
                              </p>
                              <p className="text-sm text-brown/50">
                                {booking.address}
                              </p>
                            </div>
                            <p className="text-xl font-bold text-orange">
                              ${booking.total}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 mt-4 flex-wrap">
                            <Link
                              href={`/account/bookings/${booking.id}`}
                              className="rounded-lg border border-orange/30 bg-orange/5 px-4 py-2 text-base text-orange font-semibold hover:bg-orange/10 transition"
                            >
                              View Details
                            </Link>
                            {isCancellable(booking) && (
                              <button
                                onClick={() => handleCancel(booking.id)}
                                disabled={cancellingId === booking.id}
                                className="rounded-lg border border-red-200 px-4 py-2 text-base text-red-500 font-semibold hover:bg-red-50 transition disabled:opacity-50"
                              >
                                {cancellingId === booking.id
                                  ? "Cancelling..."
                                  : "Cancel Booking"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past Bookings */}
                {pastBookings.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-brown-dark mb-4">
                      Past Washes
                    </h2>
                    <div className="space-y-4">
                      {pastBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="rounded-2xl border-2 border-brown/10 bg-white p-6"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-lg font-bold text-brown-dark">
                                {formatDate(booking.scheduled_date)}
                              </p>
                              <p className="text-base text-brown/60">
                                {formatTime(booking.scheduled_start)}
                              </p>
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>

                          <div className="flex items-center justify-between">
                            <p className="text-base text-brown-dark">
                              {booking.car_size?.name} Wash
                              {booking.booking_addons?.length > 0 &&
                                ` + ${booking.booking_addons.length} add-on${booking.booking_addons.length > 1 ? "s" : ""}`}
                            </p>
                            <p className="text-lg font-bold text-brown/60">
                              ${booking.total}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 mt-4 flex-wrap">
                            <Link
                              href={`/account/bookings/${booking.id}`}
                              className="rounded-lg border border-brown/15 px-4 py-2 text-base text-brown/70 font-semibold hover:border-orange hover:text-brown-dark transition"
                            >
                              View Details
                            </Link>
                            {(booking.status === "completed" ||
                              booking.status === "confirmed") && (
                              <Link
                                href={`/book?rebook=${booking.id}`}
                                className="rounded-lg bg-orange/10 border border-orange/20 px-4 py-2 text-base text-orange font-semibold hover:bg-orange/20 transition"
                              >
                                Book Again
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
