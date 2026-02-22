import Link from "next/link";

const carSizes = [
  {
    name: "Small",
    price: 40,
    time: "~45 min",
    examples: "Sedans, coupes, compact cars",
  },
  {
    name: "Medium",
    price: 55,
    time: "~55 min",
    examples: "SUVs, crossovers, wagons",
    popular: true,
  },
  {
    name: "Large",
    price: 70,
    time: "~65 min",
    examples: "Trucks, full-size SUVs, vans",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="px-6 py-24 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-3 text-brown-dark">Pricing</h2>
      <p className="text-center text-brown/60 mb-16 max-w-lg mx-auto">
        No surprises. Just pick your size and go.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {carSizes.map((size) => (
          <div
            key={size.name}
            className={`relative rounded-2xl border-2 p-8 text-center transition ${
              size.popular
                ? "border-orange bg-orange/10 scale-[1.02]"
                : "border-brown/15 hover:border-brown/30"
            }`}
          >
            {size.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange px-4 py-1 text-xs font-bold text-white">
                Most Popular
              </span>
            )}
            <h3 className="text-2xl font-bold mb-1 text-brown-dark">{size.name}</h3>
            <p className="text-sm text-brown/50 mb-6">{size.examples}</p>
            <div className="mb-1">
              <span className="text-5xl font-bold text-brown-dark">${size.price}</span>
            </div>
            <p className="text-sm text-brown/40 mb-8">{size.time}</p>
            <Link
              href="/book"
              className={`block rounded-full px-6 py-2.5 text-sm font-bold transition ${
                size.popular
                  ? "bg-orange text-white hover:bg-orange-dark"
                  : "border-2 border-brown/20 text-brown/70 hover:border-orange hover:text-brown-dark"
              }`}
            >
              Book Now
            </Link>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-brown/40 mt-8">
        Add-ons available during booking — interior detail, tire shine, and more.
      </p>
    </section>
  );
}
