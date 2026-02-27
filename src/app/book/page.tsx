"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface CarSize {
  id: string;
  name: string;
  description: string;
  base_price: number;
  wash_time_minutes: number;
}

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
  time_minutes: number;
}

interface TimeSlot {
  start: string;
  end: string;
}

type Step = "size" | "addons" | "datetime" | "info" | "review" | "confirmed";

function BookContent() {
  const searchParams = useSearchParams();
  const rebookId = searchParams.get("rebook");

  const [step, setStep] = useState<Step>("size");
  const [carSizes, setCarSizes] = useState<CarSize[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebookBanner, setRebookBanner] = useState(false);

  // Selections
  const [selectedSize, setSelectedSize] = useState<CarSize | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Customer info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Confirmation
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    booking_id: string;
    total: number;
    scheduled_date: string;
    scheduled_start: string;
    scheduled_end: string;
  } | null>(null);
  const [error, setError] = useState("");

  // Load services + handle rebook pre-fill
  useEffect(() => {
    const loadData = async () => {
      try {
        const servicesRes = await fetch("/api/booking/services");
        const servicesData = await servicesRes.json();
        const loadedSizes = servicesData.car_sizes || [];
        const loadedAddons = servicesData.addons || [];
        setCarSizes(loadedSizes);
        setAddons(loadedAddons);

        // If rebooking, pre-fill from previous booking
        if (rebookId) {
          try {
            const rebookRes = await fetch(
              `/api/account/rebook?id=${rebookId}`
            );
            if (rebookRes.ok) {
              const rebookData = await rebookRes.json();

              // Pre-fill car size
              const size = loadedSizes.find(
                (s: CarSize) => s.id === rebookData.car_size_id
              );
              if (size) setSelectedSize(size);

              // Pre-fill addons
              const selectedAddonsList = loadedAddons.filter((a: Addon) =>
                rebookData.addon_ids.includes(a.id)
              );
              setSelectedAddons(selectedAddonsList);

              // Pre-fill customer info
              if (rebookData.customer_name) setName(rebookData.customer_name);
              if (rebookData.customer_email)
                setEmail(rebookData.customer_email);
              if (rebookData.customer_phone)
                setPhone(rebookData.customer_phone);
              if (rebookData.address) setAddress(rebookData.address);
              if (rebookData.notes) setNotes(rebookData.notes);

              setRebookBanner(true);

              // Skip to date/time step since size + addons are pre-filled
              if (size) setStep("datetime");
            }
          } catch {
            // Rebook pre-fill failed, just proceed normally
          }
        }
      } catch {
        setError("Failed to load services");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [rebookId]);

  // Calculate totals
  const basePrice = selectedSize?.base_price || 0;
  const addonTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const total = basePrice + addonTotal;
  const totalDuration =
    (selectedSize?.wash_time_minutes || 0) +
    selectedAddons.reduce((sum, a) => sum + a.time_minutes, 0);

  // Load slots when date changes
  const loadSlots = useCallback(async (date: string) => {
    if (!date || !totalDuration) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const res = await fetch(
        `/api/booking/slots?date=${date}&duration=${totalDuration}`
      );
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [totalDuration]);

  useEffect(() => {
    if (selectedDate && totalDuration > 0) {
      loadSlots(selectedDate);
    }
  }, [selectedDate, totalDuration, loadSlots]);

  // Get minimum date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // Submit booking — redirect to Stripe Checkout
  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/booking/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_size_id: selectedSize!.id,
          addon_ids: selectedAddons.map((a) => a.id),
          address,
          lat: null,
          lng: null,
          scheduled_date: selectedDate,
          scheduled_start: selectedSlot!.start,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed");
        setSubmitting(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Payment setup failed. Please try again.");
        setSubmitting(false);
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

  // Progress indicator
  const steps: { key: Step; label: string }[] = [
    { key: "size", label: "Size" },
    { key: "addons", label: "Add-ons" },
    { key: "datetime", label: "Date & Time" },
    { key: "info", label: "Your Info" },
    { key: "review", label: "Review" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-brown/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <nav className="border-b border-brown/10 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/nav-icon.png"
              alt="ATX Scrubbin'"
              width={36}
              height={36}
              className="rounded-full"
            />
            <span className="text-xl font-bold text-brown-dark">
              ATX <span className="text-orange">Scrubbin&apos;</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-base text-brown/60 hover:text-brown-dark transition"
          >
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 pb-28">
        {/* Progress */}
        {step !== "confirmed" && (
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-10">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                    i <= currentIndex
                      ? "bg-orange text-white"
                      : "bg-brown/10 text-brown/40"
                  }`}
                >
                  {i < currentIndex ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs hidden sm:block ${
                    i <= currentIndex ? "text-brown-dark" : "text-brown/30"
                  }`}
                >
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className={`w-6 sm:w-10 h-0.5 ${
                      i < currentIndex ? "bg-orange" : "bg-brown/10"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {rebookBanner && step !== "confirmed" && (
          <div className="mb-6 p-4 rounded-xl bg-orange/10 border border-orange/20 text-brown-dark text-base">
            Rebooking from a previous wash — your selections are pre-filled.
            Just pick a new date and time!
          </div>
        )}

        {/* Step 1: Car Size */}
        {step === "size" && (
          <div>
            <h1 className="text-3xl font-bold text-brown-dark mb-2">
              Pick Your Ride Size
            </h1>
            <p className="text-brown/60 mb-8">
              What are we working with?
            </p>
            <div className="grid gap-4">
              {carSizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => {
                    setSelectedSize(size);
                    setStep("addons");
                  }}
                  className={`text-left rounded-2xl border-2 p-6 transition hover:border-orange active:scale-[0.99] ${
                    selectedSize?.id === size.id
                      ? "border-orange bg-orange/5"
                      : "border-brown/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-brown-dark">
                        {size.name}
                      </h3>
                      <p className="text-base text-brown/60 mt-1">
                        {size.description}
                      </p>
                      <p className="text-sm text-brown/50 mt-1">
                        ~{size.wash_time_minutes} min
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-brown-dark">
                      ${size.base_price}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Add-ons */}
        {step === "addons" && (
          <div>
            <h1 className="text-3xl font-bold text-brown-dark mb-2">
              Any Add-ons?
            </h1>
            <p className="text-brown/60 mb-8">
              Optional extras to make your ride extra clean.
            </p>
            {addons.length === 0 ? (
              <p className="text-brown/40 text-center py-8">
                No add-ons available right now.
              </p>
            ) : (
              <div className="grid gap-4 mb-8">
                {addons.map((addon) => {
                  const isSelected = selectedAddons.some(
                    (a) => a.id === addon.id
                  );
                  return (
                    <button
                      key={addon.id}
                      onClick={() => {
                        setSelectedAddons((prev) =>
                          isSelected
                            ? prev.filter((a) => a.id !== addon.id)
                            : [...prev, addon]
                        );
                      }}
                      className={`text-left rounded-2xl border-2 p-6 transition hover:border-orange ${
                        isSelected
                          ? "border-orange bg-orange/5"
                          : "border-brown/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition ${
                              isSelected
                                ? "bg-orange border-orange text-white"
                                : "border-brown/20"
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-brown-dark">
                              {addon.name}
                            </h3>
                            <p className="text-base text-brown/60">
                              {addon.description}
                            </p>
                            <p className="text-sm text-brown/50 mt-1">
                              +{addon.time_minutes} min
                            </p>
                          </div>
                        </div>
                        <div className="text-lg font-bold text-brown-dark">
                          +${addon.price}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setStep("size")}
                className="flex items-center gap-1 text-base text-brown/70 hover:text-brown-dark py-3 px-1 transition active:text-orange"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              <button
                onClick={() => setStep("datetime")}
                className="rounded-full bg-orange px-8 py-3.5 font-bold text-white transition hover:bg-orange-dark active:scale-[0.98]"
              >
                {selectedAddons.length === 0 ? "Skip" : "Next"} &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === "datetime" && (
          <div>
            <h1 className="text-3xl font-bold text-brown-dark mb-2">
              When Works for You?
            </h1>
            <p className="text-brown/60 mb-8">
              Pick a day and we&apos;ll show you what&apos;s open.
            </p>

            <div className="mb-8">
              <label className="block text-base font-bold text-brown-dark mb-2">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDate}
                className="w-full rounded-xl border-2 border-brown/10 bg-white px-4 py-3.5 text-brown-dark text-base focus:border-orange focus:outline-none transition"
              />
            </div>

            {selectedDate && (
              <div>
                <label className="block text-base font-bold text-brown-dark mb-3">
                  Available Times
                </label>
                {slotsLoading ? (
                  <p className="text-brown/40 text-center py-6">
                    Loading available times...
                  </p>
                ) : slots.length === 0 ? (
                  <div className="text-center py-6 rounded-xl bg-sand/50 border border-brown/10">
                    <p className="text-brown/50">
                      No times available on this day.
                    </p>
                    <p className="text-sm text-brown/30 mt-1">
                      Try a different date!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {slots.map((slot) => (
                      <button
                        key={slot.start}
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-xl border-2 px-4 py-4 text-center font-semibold text-base transition hover:border-orange active:scale-[0.98] ${
                          selectedSlot?.start === slot.start
                            ? "border-orange bg-orange/5 text-brown-dark"
                            : "border-brown/10 text-brown/70"
                        }`}
                      >
                        {formatTime(slot.start)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setStep("addons")}
                className="flex items-center gap-1 text-base text-brown/70 hover:text-brown-dark py-3 px-1 transition active:text-orange"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              <button
                onClick={() => setStep("info")}
                disabled={!selectedSlot}
                className="rounded-full bg-orange px-8 py-3.5 font-bold text-white transition hover:bg-orange-dark disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Customer Info */}
        {step === "info" && (
          <div>
            <h1 className="text-3xl font-bold text-brown-dark mb-2">
              Tell Us About You
            </h1>
            <p className="text-brown/60 mb-8">
              So we know who we&apos;re scrubbin&apos; for.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-base font-bold text-brown-dark mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border-2 border-brown/10 bg-white px-4 py-3 text-brown-dark placeholder:text-brown/30 focus:border-orange focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-brown-dark mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border-2 border-brown/10 bg-white px-4 py-3 text-brown-dark placeholder:text-brown/30 focus:border-orange focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-brown-dark mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(512) 555-1234"
                  className="w-full rounded-xl border-2 border-brown/10 bg-white px-4 py-3 text-brown-dark placeholder:text-brown/30 focus:border-orange focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-brown-dark mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Where should we come?"
                  className="w-full rounded-xl border-2 border-brown/10 bg-white px-4 py-3 text-brown-dark placeholder:text-brown/30 focus:border-orange focus:outline-none transition"
                />
                <p className="text-sm text-brown/50 mt-1">
                  Full street address in Austin, TX
                </p>
              </div>
              <div>
                <label className="block text-base font-bold text-brown-dark mb-1">
                  Notes <span className="font-normal text-brown/40">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything we should know? Gate code, special requests, etc."
                  rows={3}
                  className="w-full rounded-xl border-2 border-brown/10 bg-white px-4 py-3 text-brown-dark placeholder:text-brown/30 focus:border-orange focus:outline-none transition resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setStep("datetime")}
                className="flex items-center gap-1 text-base text-brown/70 hover:text-brown-dark py-3 px-1 transition active:text-orange"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              <button
                onClick={() => setStep("review")}
                disabled={!name || !email || !phone || !address}
                className="rounded-full bg-orange px-8 py-3.5 font-bold text-white transition hover:bg-orange-dark disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Review &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === "review" && (
          <div>
            <h1 className="text-3xl font-bold text-brown-dark mb-2">
              Looking Good?
            </h1>
            <p className="text-brown/60 mb-8">
              Double check everything before we lock it in.
            </p>

            <div className="rounded-2xl border-2 border-brown/10 bg-white p-6 space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-base text-brown/60">Car Size</p>
                  <p className="font-bold text-brown-dark">
                    {selectedSize?.name}
                  </p>
                </div>
                <p className="font-bold text-brown-dark">
                  ${selectedSize?.base_price}
                </p>
              </div>

              {selectedAddons.length > 0 && (
                <div className="border-t border-brown/5 pt-4">
                  <p className="text-sm text-brown/50 mb-2">Add-ons</p>
                  {selectedAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex justify-between items-center"
                    >
                      <p className="text-brown-dark">{addon.name}</p>
                      <p className="text-brown-dark">+${addon.price}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-brown/5 pt-4">
                <p className="text-base text-brown/60">When</p>
                <p className="font-bold text-brown-dark">
                  {formatDate(selectedDate)} at{" "}
                  {selectedSlot && formatTime(selectedSlot.start)}
                </p>
                <p className="text-sm text-brown/50">
                  ~{totalDuration} minutes
                </p>
              </div>

              <div className="border-t border-brown/5 pt-4">
                <p className="text-base text-brown/60">Where</p>
                <p className="font-bold text-brown-dark">{address}</p>
              </div>

              <div className="border-t border-brown/5 pt-4">
                <p className="text-base text-brown/60">Your Info</p>
                <p className="text-brown-dark">{name}</p>
                <p className="text-sm text-brown/60">
                  {email} &middot; {phone}
                </p>
              </div>

              {notes && (
                <div className="border-t border-brown/5 pt-4">
                  <p className="text-base text-brown/60">Notes</p>
                  <p className="text-brown/70">{notes}</p>
                </div>
              )}

              <div className="border-t-2 border-orange/20 pt-4 flex justify-between items-center">
                <p className="text-lg font-bold text-brown-dark">Total</p>
                <p className="text-2xl font-bold text-orange">${total}</p>
              </div>
            </div>

            <p className="text-sm text-brown/50 text-center mt-4">
              You&apos;ll be redirected to a secure payment page.
            </p>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 mt-8">
              <button
                onClick={() => setStep("info")}
                className="flex items-center gap-1 text-base text-brown/70 hover:text-brown-dark py-3 px-1 transition active:text-orange"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full sm:w-auto rounded-full bg-orange px-10 py-4 text-lg font-bold text-white transition hover:bg-orange-dark active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? "Redirecting to payment..." : "Pay & Confirm"}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {step === "confirmed" && bookingResult && (
          <div className="text-center py-10">
            <div className="text-6xl mb-6">🤠</div>
            <h1 className="text-3xl font-bold text-brown-dark mb-3">
              You&apos;re All Set!
            </h1>
            <p className="text-brown/60 mb-8 max-w-md mx-auto">
              We&apos;ll be at your place on{" "}
              <strong>{formatDate(bookingResult.scheduled_date)}</strong> at{" "}
              <strong>{formatTime(bookingResult.scheduled_start)}</strong>.
              See you then!
            </p>

            <div className="inline-block rounded-2xl border-2 border-orange/20 bg-orange/5 px-8 py-5 mb-8">
              <p className="text-base text-brown/60">Total</p>
              <p className="text-3xl font-bold text-orange">
                ${bookingResult.total}
              </p>
              <p className="text-sm text-brown/50 mt-1">
                Pay at time of service
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/"
                className="rounded-full border-2 border-brown/15 px-8 py-3 font-bold text-brown/70 transition hover:border-orange hover:text-brown-dark"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}

        {/* Running total bar */}
        {step !== "confirmed" && selectedSize && (
          <div className="fixed bottom-0 left-0 right-0 bg-black shadow-[0_-4px_20px_rgba(0,0,0,0.15)] px-6 py-5">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-white">
                  {selectedSize.name}
                  {selectedAddons.length > 0 &&
                    ` + ${selectedAddons.length} add-on${selectedAddons.length > 1 ? "s" : ""}`}
                </p>
                <p className="text-base text-white/60">~{totalDuration} min</p>
              </div>
              <p className="text-3xl font-bold text-orange">${total}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <p className="text-brown/60">Loading...</p>
        </div>
      }
    >
      <BookContent />
    </Suspense>
  );
}
