"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

interface BookingInfo {
  id: string;
  customer_name: string;
  service: string;
  scheduled_date: string;
  scheduled_start: string;
  total: number;
  tip_amount: number;
  already_tipped: boolean;
  status: string;
}

function TipContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = params.id as string;
  const thanks = searchParams.get("thanks") === "true";

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tipAmount, setTipAmount] = useState(10);
  const [customTip, setCustomTip] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const res = await fetch(`/api/tip?booking_id=${bookingId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not load booking");
          return;
        }
        setBooking(data);
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  const handleTip = async () => {
    if (tipAmount <= 0) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, tip_amount: tipAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to set up tip");
        setSubmitting(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
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
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-brown/60">Loading...</p>
      </div>
    );
  }

  // Thank you state (returned from Stripe)
  if (thanks || (booking && booking.already_tipped)) {
    return (
      <div className="min-h-screen bg-cream">
        <nav className="sticky top-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center justify-between px-6 py-3 max-w-3xl mx-auto">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold tracking-tight text-white">
                Keep Austin <span className="text-orange">Scrubbin&apos;</span>
              </span>
            </Link>
          </div>
        </nav>

        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="text-6xl mb-6">🙏</div>
          <h1 className="text-3xl font-bold text-brown-dark mb-3">
            {thanks ? "Thank You!" : "You Already Tipped!"}
          </h1>
          <p className="text-brown/60 mb-8 max-w-md mx-auto">
            {thanks
              ? "Your tip means the world to our crew. Thanks for supporting local! 🤠"
              : `You already left a $${Number(booking?.tip_amount || 0).toFixed(2)} tip. The crew appreciates you! 🤠`}
          </p>
          <Link
            href="/"
            className="inline-block rounded-full bg-orange px-8 py-4 font-bold text-white transition hover:bg-orange-dark active:scale-[0.98]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-brown/60 mb-4">{error}</p>
          <Link href="/" className="text-orange font-bold hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <nav className="sticky top-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-3 max-w-3xl mx-auto">
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold tracking-tight text-white">
              Keep Austin <span className="text-orange">Scrubbin&apos;</span>
            </span>
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">✨</div>
          <h1 className="text-3xl font-bold text-brown-dark mb-2">
            Your ride is looking fresh!
          </h1>
          <p className="text-brown/60">
            Want to show the crew some love? 100% of tips go to the team.
          </p>
        </div>

        {booking && (
          <div className="rounded-2xl border-2 border-brown/10 bg-white p-5 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-brown/50">Service</p>
                <p className="font-bold text-brown-dark">{booking.service} Car Wash</p>
              </div>
              <p className="font-bold text-brown-dark">${Number(booking.total).toFixed(2)}</p>
            </div>
            <div className="border-t border-brown/5 mt-3 pt-3">
              <p className="text-sm text-brown/50">Date</p>
              <p className="text-brown-dark">
                {formatDate(booking.scheduled_date)} at {formatTime(booking.scheduled_start)}
              </p>
            </div>
          </div>
        )}

        {/* Tip selector */}
        <div className="rounded-2xl border-2 border-brown/10 bg-white p-6">
          <p className="font-bold text-brown-dark mb-4">Select a tip amount</p>
          <div className="flex gap-2 flex-wrap">
            {[5, 10, 15, 20].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => { setTipAmount(amt); setCustomTip(""); }}
                className={`rounded-full px-6 py-3 text-lg font-semibold border-2 transition ${
                  tipAmount === amt && customTip === ""
                    ? "border-orange bg-orange/10 text-orange"
                    : "border-brown/10 text-brown/70 hover:border-brown/30"
                }`}
              >
                ${amt}
              </button>
            ))}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brown/40 font-semibold text-lg">$</span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Other"
                value={customTip}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomTip(val);
                  const parsed = parseFloat(val);
                  setTipAmount(parsed > 0 ? parsed : 0);
                }}
                className={`w-24 rounded-full pl-7 pr-3 py-3 text-lg font-semibold border-2 transition outline-none ${
                  customTip !== ""
                    ? "border-orange bg-orange/10 text-orange"
                    : "border-brown/10 text-brown/70 hover:border-brown/30"
                }`}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm mt-3">{error}</p>
          )}

          <button
            onClick={handleTip}
            disabled={submitting || tipAmount <= 0}
            className="w-full mt-6 rounded-full bg-orange px-10 py-4 text-lg font-bold text-white transition hover:bg-orange-dark active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "Redirecting to payment..." : `Send $${tipAmount.toFixed(2)} Tip`}
          </button>
        </div>

        <p className="text-sm text-brown/40 text-center mt-4">
          You&apos;ll be redirected to a secure payment page.
        </p>
      </div>
    </div>
  );
}

export default function TipPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <p className="text-brown/60">Loading...</p>
        </div>
      }
    >
      <TipContent />
    </Suspense>
  );
}
