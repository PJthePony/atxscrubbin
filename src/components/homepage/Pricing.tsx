"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface CarSize {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  wash_time_minutes: number;
  sort_order: number;
}

export default function Pricing() {
  const [carSizes, setCarSizes] = useState<CarSize[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/booking/services")
      .then((res) => res.json())
      .then((data) => {
        setCarSizes(data.car_sizes || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="px-6 py-24 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-3 text-brown-dark">Pricing</h2>
      <p className="text-center text-brown/60 mb-16 max-w-lg mx-auto">
        No surprises. Just pick your size and go.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange/30 border-t-orange rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {carSizes.map((size) => (
              <div
                key={size.id}
                className="rounded-2xl border-2 border-brown/15 p-8 text-center transition hover:border-brown/30"
              >
                <h3 className="text-2xl font-bold mb-1 text-brown-dark">{size.name}</h3>
                <p className="text-sm text-brown/50 mb-6">
                  {size.description || ""}
                </p>
                <div className="mb-1">
                  <span className="text-5xl font-bold text-brown-dark">
                    ${size.base_price}
                  </span>
                </div>
                <p className="text-sm text-brown/40 mb-8">
                  ~{size.wash_time_minutes} min
                </p>
                <Link
                  href="/book"
                  className="block rounded-full px-6 py-3.5 text-base font-bold transition active:scale-[0.98] bg-brown-dark text-white hover:bg-brown-light"
                >
                  Book Now
                </Link>
              </div>
            ))}
        </div>
      )}

      <p className="text-center text-sm text-brown/40 mt-8">
        Add-ons available during booking — interior detail, tire shine, and more.
      </p>
    </section>
  );
}
