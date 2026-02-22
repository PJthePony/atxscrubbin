export default function ServiceAreaPreview() {
  return (
    <section id="area" className="px-6 py-24 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-3 text-brown-dark">Service Area</h2>
      <p className="text-center text-brown/60 mb-12 max-w-lg mx-auto">
        We&apos;re all over central Austin. If you&apos;re not sure, just try booking — we&apos;ll let you know.
      </p>
      <div className="rounded-2xl border-2 border-brown/15 bg-sand/50 overflow-hidden">
        <div className="h-72 sm:h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">📍</div>
            <p className="text-sm text-brown/50">Interactive map coming soon</p>
            <p className="text-xs text-brown/30 mt-1">Enter your address when you book to check if we cover your area</p>
          </div>
        </div>
      </div>
    </section>
  );
}
