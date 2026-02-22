"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
      <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/nav-icon.png" alt="ATX Scrubbin'" width={36} height={36} className="rounded-full" />
          <span className="text-xl font-bold tracking-tight text-white">
            ATX <span className="text-orange">Scrubbin&apos;</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-sm text-white/60 hover:text-white transition">
            How It Works
          </a>
          <a href="#pricing" className="text-sm text-white/60 hover:text-white transition">
            Pricing
          </a>
          <a href="#area" className="text-sm text-white/60 hover:text-white transition">
            Service Area
          </a>
          <a href="#about" className="text-sm text-white/60 hover:text-white transition">
            About
          </a>
          <a href="#contact" className="text-sm text-white/60 hover:text-white transition">
            Contact
          </a>
          <Link
            href="/book"
            className="rounded-full bg-orange px-5 py-2 text-sm font-semibold text-black transition hover:bg-orange-dark"
          >
            Book a Wash
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white/60 hover:text-white"
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
        <div className="md:hidden border-t border-white/10 bg-black px-6 py-4 space-y-4">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block text-white/60 hover:text-white transition">
            How It Works
          </a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} className="block text-white/60 hover:text-white transition">
            Pricing
          </a>
          <a href="#area" onClick={() => setMenuOpen(false)} className="block text-white/60 hover:text-white transition">
            Service Area
          </a>
          <a href="#about" onClick={() => setMenuOpen(false)} className="block text-white/60 hover:text-white transition">
            About
          </a>
          <a href="#contact" onClick={() => setMenuOpen(false)} className="block text-white/60 hover:text-white transition">
            Contact
          </a>
          <Link
            href="/book"
            onClick={() => setMenuOpen(false)}
            className="block rounded-full bg-orange px-5 py-2 text-sm font-semibold text-black text-center transition hover:bg-orange-dark"
          >
            Book a Wash
          </Link>
        </div>
      )}
    </nav>
  );
}
