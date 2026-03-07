"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface BookingDetail {
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
  car_size: {
    id: string;
    name: string;
    base_price: number;
    wash_time_minutes: number;
  };
  booking_addons: {
    addon: { id: string; name: string; price: number };
    price_at_booking: number;
  }[];
}

interface CustomerData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [cancellingId, setCancellingId] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");

  // Try to load from sessionStorage if user already looked up
  useEffect(() => {
    const saved = sessionStorage.getItem("account_email");
    if (saved) {
      setEmail(saved);
      loadBooking(saved);
    }
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

  const loadBooking = async (lookupEmail: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/account/bookings?email=${encodeURIComponent(lookupEmail.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setCustomer(data.customer);
      sessionStorage.setItem("account_email", lookupEmail.trim());

      // Find this specific booking
      const found = data.bookings.find(
        (b: BookingDetail) => b.id === bookingId
      );
      if (found) {
        setBooking(found);
      } else {
        setError("Booking not found or doesn't belong to this account.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    loadBooking(email);
  };

  const handleCancel = async () => {
    if (
      !confirm(
        "Are you sure you want to cancel this booking? You'll receive a full refund."
      )
    )
      return;

    setCancellingId(true);
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
      // Reload booking to get updated status
      await loadBooking(email);
    } catch {
      setCancelMessage("Something went wrong. Please try again.");
    } finally {
      setCancellingId(false);
    }
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
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
    const styles: Record<string, string> = {
      confirmed: "bg-green-100 text-green-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-brown/10 text-brown/60",
      cancelled: "bg-red-100 text-red-700",
      refunded: "bg-orange/10 text-orange-dark",
    };
    const labels: Record<string, string> = {
      confirmed: "Confirmed",
      in_progress: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
      refunded: "Refunded",
    };
    return (
      <span
        className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${styles[status] || ""}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  const isCancellable = () => {
    if (!booking || booking.status !== "confirmed") return false;
    const now = new Date();
    const bookingDate = new Date(
      `${booking.scheduled_date}T${booking.scheduled_start}`
    );
    const hoursUntil =
      (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil >= 24;
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-3 max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/nav-icon.png"
              alt="Keep Austin Scrubbin'"
              width={36}
              height={36}
              className="rounded-full"
            />
            <span className="text-2xl font-bold tracking-tight text-white">
              Keep Austin <span className="text-orange">Scrubbin&apos;</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/account")}
              className="text-base text-white/60 hover:text-white transition"
            >
              &larr; My Washes
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Email Lookup (if not already signed in) */}
        {!customer && !loading && (
          <div>
            <h1 className="text-3xl font-bold text-brown-dark mb-2">
              Booking Details
            </h1>
            <p className="text-brown/60 mb-8">
              Enter your email to view this booking.
            </p>
            <form onSubmit={handleLookup}>
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
                  className="rounded-xl bg-orange px-6 py-3 font-bold text-white transition hover:bg-orange-dark"
                >
                  Look Up
                </button>
              </div>
              {error && (
                <p className="mt-3 text-red-600 text-base">{error}</p>
              )}
            </form>
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <p className="text-brown/60">Loading...</p>
          </div>
        )}

        {/* Booking Detail */}
        {booking && customer && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-brown-dark">
                Booking Details
              </h1>
              {getStatusBadge(booking.status)}
            </div>

            {cancelMessage && (
              <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-base">
                {cancelMessage}
              </div>
            )}

            <div className="rounded-2xl border-2 border-brown/10 bg-white p-6 space-y-5 mb-6">
              {/* Date & Time */}
              <div>
                <p className="text-sm text-brown/50 mb-1">When</p>
                <p className="text-lg font-bold text-brown-dark">
                  {formatDateLong(booking.scheduled_date)}
                </p>
                <p className="text-base text-brown/60">
                  {formatTime(booking.scheduled_start)} &ndash;{" "}
                  {formatTime(booking.scheduled_end)} (~
                  {booking.estimated_duration_minutes} min)
                </p>
              </div>

              {/* Location */}
              <div className="border-t border-brown/5 pt-4">
                <p className="text-sm text-brown/50 mb-1">Where</p>
                <p className="text-base font-bold text-brown-dark">
                  {booking.address}
                </p>
              </div>

              {/* Service */}
              <div className="border-t border-brown/5 pt-4">
                <p className="text-sm text-brown/50 mb-1">Service</p>
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-brown-dark">
                    {booking.car_size?.name} Wash
                  </p>
                  <p className="text-base text-brown-dark">
                    ${booking.car_size?.base_price}
                  </p>
                </div>
              </div>

              {/* Add-ons */}
              {booking.booking_addons?.length > 0 && (
                <div className="border-t border-brown/5 pt-4">
                  <p className="text-sm text-brown/50 mb-2">Add-ons</p>
                  {booking.booking_addons.map((ba, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between"
                    >
                      <p className="text-base text-brown-dark">
                        {ba.addon?.name}
                      </p>
                      <p className="text-base text-brown-dark">
                        +${ba.price_at_booking}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {booking.notes && (
                <div className="border-t border-brown/5 pt-4">
                  <p className="text-sm text-brown/50 mb-1">Notes</p>
                  <p className="text-base text-brown/70">{booking.notes}</p>
                </div>
              )}

              {/* Total */}
              <div className="border-t-2 border-orange/20 pt-4 flex justify-between items-center">
                <p className="text-lg font-bold text-brown-dark">Total</p>
                <p className="text-2xl font-bold text-orange">
                  ${booking.total}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Rebook */}
              {(booking.status === "completed" ||
                booking.status === "cancelled" ||
                booking.status === "refunded") && (
                <Link
                  href={`/book?rebook=${booking.id}`}
                  className="flex-1 rounded-xl bg-orange px-6 py-4 font-bold text-white text-center transition hover:bg-orange-dark"
                >
                  Book Again
                </Link>
              )}

              {/* Cancel */}
              {isCancellable() && (
                <button
                  onClick={handleCancel}
                  disabled={cancellingId}
                  className="flex-1 rounded-xl border-2 border-red-200 px-6 py-4 font-bold text-red-600 text-center transition hover:bg-red-50 disabled:opacity-50"
                >
                  {cancellingId ? "Cancelling..." : "Cancel Booking"}
                </button>
              )}

              {/* Can't cancel message */}
              {booking.status === "confirmed" && !isCancellable() && (
                <p className="text-sm text-brown/50 text-center py-2">
                  Cancellations must be made at least 24 hours before your
                  appointment. Need help? Email us at{" "}
                  <a
                    href="mailto:keepaustinscrubbin@gmail.com"
                    className="text-orange hover:text-orange-dark"
                  >
                    keepaustinscrubbin@gmail.com
                  </a>
                </p>
              )}
            </div>

            {/* Booking ID */}
            <p className="text-sm text-brown/30 text-center mt-8">
              Booking ID: {booking.id.slice(0, 8)}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
