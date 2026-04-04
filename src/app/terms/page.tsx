import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions | Keep Austin Scrubbin'",
  description: "Terms and Conditions for Keep Austin Scrubbin' mobile car wash service.",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-serif font-bold text-brown-dark mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-brown/50 mb-8">Last updated: February 22, 2026</p>

        <div className="prose prose-brown space-y-6 text-brown-dark/80 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">1. About Our Service</h2>
            <p>
              Keep Austin Scrubbin&apos; is a mobile car wash service operating in Austin, Texas. We come to your
              location and wash your vehicle on-site. By booking a service through our website at
              www.atxscrubbin.com, you agree to these Terms &amp; Conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">2. Booking &amp; Payment</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>All bookings are made through our website and require payment at the time of booking.</li>
              <li>Payments are processed securely through Stripe. We do not store your payment card details.</li>
              <li>Prices are listed on our website and may be updated at any time. The price at the time of your booking is the price you pay.</li>
              <li>You will receive a booking confirmation via text message after payment is processed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">3. Service Area</h2>
            <p>
              We service select areas within Austin, Texas. Service availability is verified during the booking
              process. We reserve the right to decline bookings outside our service area.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">4. Cancellations &amp; Refunds</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>If you need to cancel or reschedule, please contact us as soon as possible.</li>
              <li>Refunds are issued at our discretion and processed back to your original payment method via Stripe.</li>
              <li>If we are unable to perform the service due to weather or other circumstances beyond our control, we will reschedule your appointment or issue a full refund.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">5. SMS/Text Messaging Terms</h2>
            <p>
              <strong>Program Name:</strong> Keep Austin Scrubbin&apos; Booking Notifications
            </p>
            <p className="mt-3">
              <strong>Program Description:</strong> When you book a car wash through our website and provide your
              phone number, you will receive text messages related to your booking, including confirmations,
              reminders, and service updates.
            </p>
            <p className="mt-3">
              <strong>Message Frequency:</strong> Message frequency varies based on your booking activity.
              You will typically receive 2–4 messages per booking (confirmation, day-before reminder, hour-before
              reminder, and completion notification).
            </p>
            <p className="mt-3">
              <strong>Message &amp; Data Rates:</strong> Message and data rates may apply. Check with your mobile
              carrier for details about your text messaging plan.
            </p>
            <p className="mt-3">
              <strong>Opt-Out:</strong> You can opt out of text messages at any time by replying{" "}
              <strong>STOP</strong> to any message you receive from us. After opting out, you will receive one
              final confirmation message and will no longer receive texts from us.
            </p>
            <p className="mt-3">
              <strong>Help:</strong> For help with text messaging, reply <strong>HELP</strong> to any message
              or contact us at keep.austin.scrubbin@gmail.com.
            </p>
            <p className="mt-3">
              <strong>Support Contact:</strong> Keep Austin Scrubbin&apos;, Austin, TX —
              keep.austin.scrubbin@gmail.com
            </p>
            <p className="mt-3">
              <strong>Carriers:</strong> Compatible with all major US carriers. Carriers are not liable for
              delayed or undelivered messages.
            </p>
            <p className="mt-3">
              Your consent to receive text messages is not a condition of purchasing our services. Your phone
              number will not be shared with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">6. Your Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Ensure the vehicle is accessible at the scheduled time and address.</li>
              <li>Provide access to an outdoor water source (hose bib) for use during the wash.</li>
              <li>Provide access to an outdoor electrical outlet for our equipment.</li>
              <li>Provide accurate contact information so we can reach you regarding your appointment.</li>
              <li>Remove any valuables from the exterior of the vehicle before your appointment.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">7. Liability</h2>
            <p>
              We take great care with every vehicle we wash. However, Keep Austin Scrubbin&apos; is not
              responsible for pre-existing damage, wear, or conditions of the vehicle. If you believe our
              service caused damage, please contact us immediately so we can address your concern.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">8. Weather &amp; Scheduling</h2>
            <p>
              Mobile car washing is weather-dependent. In the event of rain or severe weather, we will contact
              you to reschedule. We will make every effort to accommodate your preferred timing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">9. Changes to These Terms</h2>
            <p>
              We may update these Terms &amp; Conditions from time to time. Changes will be posted on this page
              with an updated date. Continued use of our service after changes constitutes acceptance of the
              updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-brown-dark mt-8 mb-3">10. Contact Us</h2>
            <p>
              If you have questions about these Terms &amp; Conditions, please contact us at:
            </p>
            <p className="mt-2">
              <strong>Keep Austin Scrubbin&apos;</strong><br />
              Austin, Texas<br />
              Email: keep.austin.scrubbin@gmail.com
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
