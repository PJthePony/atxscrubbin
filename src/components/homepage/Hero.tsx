import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center px-6 py-16 sm:py-24 max-w-4xl mx-auto">
      <Image
        src="/logo-color.png"
        alt="ATX Scrubbin' mascots"
        width={220}
        height={220}
        className="mb-6 drop-shadow-lg"
        priority
      />
      <h1 className="text-4xl font-bold tracking-tight leading-tight sm:text-6xl text-brown-dark">
        We scrub so you{" "}
        <span className="text-orange">don&apos;t have to.</span>
      </h1>
      <p className="mt-5 text-lg text-brown/60 max-w-md">
        Mobile car wash that comes to your driveway. Austin, TX.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <Link
          href="/book"
          className="rounded-full bg-orange px-8 py-3 text-lg font-bold text-white transition hover:bg-orange-dark hover:scale-105"
        >
          Book a Wash
        </Link>
        <a
          href="#how-it-works"
          className="rounded-full border-2 border-brown/20 px-8 py-3 text-lg font-bold text-brown/70 transition hover:border-orange hover:text-brown-dark"
        >
          How It Works
        </a>
      </div>
    </section>
  );
}
