import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-brown/10 px-6 py-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-brown/40">
          &copy; {new Date().getFullYear()} Keep Austin Scrubbin&apos;. All
          rights reserved.
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-brown/40">
          <Link href="/book" className="hover:text-brown-dark transition">
            Book a Wash
          </Link>
          <a href="#pricing" className="hover:text-brown-dark transition">
            Pricing
          </a>
          <a href="#contact" className="hover:text-brown-dark transition">
            Contact
          </a>
          <Link href="/privacy" className="hover:text-brown-dark transition">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-brown-dark transition">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
