"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-orange/95 backdrop-blur-sm border-b border-black/10">
      <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo-color.png" alt="ATX Scrubbin'" width={40} height={40} className="rounded" />
          <span className="text-xl font-bold tracking-tight text-black">
            ATX <span className="text-white">Scrubbin&apos;</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-sm text-black/70 hover:text-black transition">
            How It Works
          </a>
          <a href="#pricing" className="text-sm text-black/70 hover:text-black transition">
            Pricing
          </a>
          <a href="#area" className="text-sm text-black/70 hover:text-black transition">
            Service Area
          </a>
          <a href="#about" className="text-sm text-black/70 hover:text-black transition">
            About
          </a>
          <a href="#contact" className="text-sm text-black/70 hover:text-black transition">
            Contact
          </a>
          <Link
            href="/book"
            className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-black/80"
          >
            Book a Wash
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-black/70 hover:text-black"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-black/10 bg-orange px-6 py-4 space-y-4">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block text-black/70 hover:text-black transition">
            How It Works
          </a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} className="block text-black/70 hover:text-black transition">
            Pricing
          </a>
          <a href="#area" onClick={() => setMenuOpen(false)} className="block text-black/70 hover:text-black transition">
            Service Area
          </a>
          <a href="#about" onClick={() => setMenuOpen(false)} className="block text-black/70 hover:text-black transition">
            About
          </a>
          <a href="#contact" onClick={() => setMenuOpen(false)} className="block text-black/70 hover:text-black transition">
            Contact
          </a>
          <Link
            href="/book"
            onClick={() => setMenuOpen(false)}
            className="block rounded-full bg-black px-5 py-2 text-sm font-semibold text-white text-center transition hover:bg-black/80"
          >
            Book a Wash
          </Link>
        </div>
      )}
    </nav>
  );
}
