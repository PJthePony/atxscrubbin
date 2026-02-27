import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-brown/10 px-6 py-12">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-base text-brown/40">
          &copy; {new Date().getFullYear()} Keep Austin Scrubbin&apos;. All
          rights reserved.
        </div>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-base text-brown/50">
          <Link href="/book" className="hover:text-brown-dark transition py-1">
            Book a Wash
          </Link>
          <a href="#pricing" className="hover:text-brown-dark transition py-1">
            Pricing
          </a>
          <a href="#contact" className="hover:text-brown-dark transition py-1">
            Contact
          </a>
          <Link href="/privacy" className="hover:text-brown-dark transition py-1">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-brown-dark transition py-1">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
