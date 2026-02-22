import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Keep Austin Scrubbin'",
  description: "Privacy Policy for Keep Austin Scrubbin' mobile car wash service.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream">
      <nav className="border-b border-brown/10 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-brown-dark font-serif text-xl font-bold hover:text-orange transition">
            Keep Austin Scrubbin&apos;
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-serif font-bold text-brown-dark mb-2">Privacy Policy</h1>
        <p className="text-sm text-brown/50 mb-8">Last updated: February 22, 2026</p>

        <div className="prose prose-brown space-y-6 text-brown-dark/80 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">1. Introduction</h2>
            <p>
              Keep Austin Scrubbin&apos; (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates a mobile car wash
              service in Austin, Texas. This Privacy Policy explains how we collect, use, and protect your personal
              information when you use our website at www.atxscrubbin.com and our related services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">2. Information We Collect</h2>
            <p>When you book a car wash or interact with our service, we may collect:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Contact information:</strong> Your name, email address, and phone number</li>
              <li><strong>Service address:</strong> The location where you&apos;d like your car washed</li>
              <li><strong>Payment information:</strong> Payment is processed securely through Stripe. We do not store your credit card number, CVV, or full payment details on our servers.</li>
              <li><strong>Booking details:</strong> Vehicle size, selected services, preferred date and time</li>
              <li><strong>Communication records:</strong> Text messages and communications related to your bookings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">3. How We Use Your Information</h2>
            <p>We use your personal information to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Process and fulfill your car wash bookings</li>
              <li>Send booking confirmations, reminders, and service updates via SMS</li>
              <li>Communicate with you about your appointments</li>
              <li>Process payments through our secure payment provider (Stripe)</li>
              <li>Improve our services and customer experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">4. SMS/Text Messaging</h2>
            <p>
              When you provide your phone number and book a service, you consent to receive text messages from
              Keep Austin Scrubbin&apos; related to your booking. These messages may include:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Booking confirmations</li>
              <li>Appointment reminders (the day before and one hour before your scheduled wash)</li>
              <li>Service completion notifications</li>
              <li>Direct communications from our team regarding your booking</li>
            </ul>
            <p className="mt-3">
              <strong>Message frequency varies</strong> based on your booking activity. Typically 2–4 messages per
              booking. Message and data rates may apply depending on your mobile carrier and plan.
            </p>
            <p className="mt-3">
              <strong>We will never share your phone number with third parties for marketing purposes.</strong> Your
              phone number is used solely for communications related to your car wash service.
            </p>
            <p className="mt-3">
              To opt out of text messages, reply <strong>STOP</strong> to any message. For help, reply{" "}
              <strong>HELP</strong> or contact us at keepaustinscrubbin@gmail.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">5. Information Sharing</h2>
            <p>
              <strong>We do not sell, rent, or share your personal information with third parties for marketing
              purposes.</strong>
            </p>
            <p className="mt-3">We may share your information only with:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Stripe:</strong> Our payment processor, to securely handle transactions</li>
              <li><strong>Twilio:</strong> Our SMS provider, to deliver text message notifications</li>
              <li><strong>Supabase:</strong> Our database provider, to securely store booking information</li>
            </ul>
            <p className="mt-3">
              These service providers are bound by their own privacy policies and only process your data as necessary
              to provide their services to us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">6. Data Security</h2>
            <p>
              We take reasonable measures to protect your personal information. Payment processing is handled
              entirely by Stripe using industry-standard encryption. Your data is stored securely using Supabase
              with row-level security policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide our services and fulfill
              the purposes described in this policy. You may request deletion of your data at any time by contacting
              us at keepaustinscrubbin@gmail.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Request access to the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Opt out of text message communications at any time by replying <strong>STOP</strong></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">9. Children&apos;s Privacy</h2>
            <p>
              Our service is not directed to children under 13. We do not knowingly collect personal information
              from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with
              an updated &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your personal data, contact us at:
            </p>
            <p className="mt-2">
              <strong>Keep Austin Scrubbin&apos;</strong><br />
              Austin, Texas<br />
              Email: keepaustinscrubbin@gmail.com
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-brown/10">
          <Link href="/" className="text-orange hover:text-orange/80 text-sm font-semibold transition">
            &larr; Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
