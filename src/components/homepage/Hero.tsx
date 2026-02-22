import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-orange">
      <div className="flex flex-col items-center justify-center text-center px-6 py-20 sm:py-28 max-w-4xl mx-auto">
        <Image
          src="/logo-color.png"
          alt="ATX Scrubbin' mascots"
          width={200}
          height={200}
          className="mb-8 drop-shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
          priority
        />
        <h1 className="text-4xl font-bold tracking-tight leading-tight sm:text-6xl text-black">
          We scrub so you{" "}
          <span className="text-white">don&apos;t have to.</span>
        </h1>
        <p className="mt-5 text-lg text-black/60 max-w-md">
          Mobile car wash that comes to your driveway. Austin, TX.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href="/book"
            className="rounded-full bg-black px-8 py-3.5 text-lg font-bold text-white transition hover:bg-black/80 hover:scale-105"
          >
            Book a Wash
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border-2 border-black/20 px-8 py-3.5 text-lg font-bold text-black/80 transition hover:border-black hover:text-black"
          >
            How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
