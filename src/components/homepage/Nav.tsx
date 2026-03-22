"use client";

import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-white/10">
      <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center">
          <span className="text-2xl font-bold tracking-tight text-white">
            Keep Austin <span className="text-orange">Scrubbin&apos;</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-base text-white/60 hover:text-white transition">
            How It Works
          </a>
          <a href="#pricing" className="text-base text-white/60 hover:text-white transition">
            Pricing
          </a>
          <a href="#area" className="text-base text-white/60 hover:text-white transition">
            Service Area
          </a>
          <a href="#about" className="text-base text-white/60 hover:text-white transition">
            About
          </a>
          <a href="#contact" className="text-base text-white/60 hover:text-white transition">
            Contact
          </a>
          <Link href="/account" className="text-base text-white/60 hover:text-white transition">
            My Washes
          </Link>
          <Link
            href="/book"
            className="rounded-full bg-orange px-6 py-2.5 text-base font-bold text-navy transition hover:bg-orange-dark"
          >
            Book a Wash
          </Link>
        </div>

        {/* Mobile hamburger — 44px minimum touch target */}
        <button
          className="md:hidden flex items-center justify-center w-11 h-11 -mr-2 text-white/60 hover:text-white rounded-lg active:bg-white/10 transition"
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

      {/* Mobile menu — larger touch targets, better spacing */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 bg-navy px-6 py-3">
          <div className="space-y-1">
            <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block py-3 text-lg text-white/70 hover:text-white active:text-orange transition">
              How It Works
            </a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="block py-3 text-lg text-white/70 hover:text-white active:text-orange transition">
              Pricing
            </a>
            <a href="#area" onClick={() => setMenuOpen(false)} className="block py-3 text-lg text-white/70 hover:text-white active:text-orange transition">
              Service Area
            </a>
            <a href="#about" onClick={() => setMenuOpen(false)} className="block py-3 text-lg text-white/70 hover:text-white active:text-orange transition">
              About
            </a>
            <a href="#contact" onClick={() => setMenuOpen(false)} className="block py-3 text-lg text-white/70 hover:text-white active:text-orange transition">
              Contact
            </a>
            <Link href="/account" onClick={() => setMenuOpen(false)} className="block py-3 text-lg text-white/70 hover:text-white active:text-orange transition">
              My Washes
            </Link>
          </div>
          <div className="pt-4 pb-2">
            <Link
              href="/book"
              onClick={() => setMenuOpen(false)}
              className="block rounded-full bg-orange px-6 py-3.5 text-lg font-bold text-navy text-center transition hover:bg-orange-dark active:scale-[0.98]"
            >
              Book a Wash
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
