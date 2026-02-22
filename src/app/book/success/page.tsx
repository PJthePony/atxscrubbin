"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");

  return (
    <div className="min-h-screen bg-cream">
      <nav className="border-b border-brown/10 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-color.png"
              alt="ATX Scrubbin'"
              width={36}
              height={36}
            />
            <span className="text-lg font-bold text-brown-dark">
              ATX <span className="text-orange">Scrubbin&apos;</span>
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

        <Link
          href="/"
          className="inline-block rounded-full border-2 border-brown/15 px-8 py-3 font-bold text-brown/70 transition hover:border-orange hover:text-brown-dark"
        >
          Back to Home
        </Link>
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
