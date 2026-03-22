import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-navy">
      <div className="flex flex-col items-center justify-center text-center px-6 py-12 sm:py-16 max-w-4xl mx-auto">
        <div className="relative w-[260px] h-[260px] mb-4">
          <Image
            src="/logo-color.png"
            alt="Keep Austin Scrubbin' mascots"
            fill
            className="object-contain drop-shadow-[0_0_30px_rgba(255,160,0,0.3)]"
            priority
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight leading-tight sm:text-6xl text-white">
          We scrub so you{" "}
          <span className="text-orange">don&apos;t have to.</span>
        </h1>
        <p className="mt-2 text-lg text-white/60 max-w-md">
          Mobile car wash that comes to your driveway. Austin, TX.
        </p>
        <p className="mt-1.5 text-sm font-bold tracking-widest uppercase text-orange/80">
          Keep Austin Scrubbin&apos;
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-4 w-full sm:w-auto px-2 sm:px-0">
          <Link
            href="/book"
            className="rounded-full bg-orange px-8 py-4 text-lg font-bold text-navy text-center transition hover:bg-orange-dark hover:scale-105 active:scale-[0.98]"
          >
            Book a Wash
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border-2 border-white/20 px-8 py-4 text-lg font-bold text-white/80 text-center transition hover:border-orange hover:text-white"
          >
            How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
