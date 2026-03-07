"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");

  return (
    <div className="min-h-screen bg-cream">
      <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-3 max-w-3xl mx-auto">
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold tracking-tight text-white">
              Keep Austin <span className="text-orange">Scrubbin&apos;</span>
            </span>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="text-6xl mb-6">🤠</div>
        <h1 className="text-3xl font-bold text-brown-dark mb-3">
          Payment Received — You&apos;re All Set!
        </h1>
        <p className="text-brown/60 mb-8 max-w-md mx-auto">
          We got your payment and your wash is locked in.
          We&apos;ll see you at your place!
        </p>

        {bookingId && (
          <p className="text-sm text-brown/40 mb-8">
            Booking ID: {bookingId.slice(0, 8)}...
          </p>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-4 px-2 sm:px-0">
          <Link
            href="/account"
            className="inline-block rounded-full bg-orange px-8 py-4 font-bold text-white text-center transition hover:bg-orange-dark active:scale-[0.98]"
          >
            View My Washes
          </Link>
          <Link
            href="/"
            className="inline-block rounded-full border-2 border-brown/15 px-8 py-4 font-bold text-brown/70 text-center transition hover:border-orange hover:text-brown-dark"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <p className="text-brown/60">Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
