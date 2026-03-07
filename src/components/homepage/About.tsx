import Image from "next/image";

export default function About() {
  return (
    <section id="about" className="px-6 py-24 max-w-3xl mx-auto text-center">
      <Image
        src="/logo-color.png"
        alt="Keep Austin Scrubbin' mascots"
        width={180}
        height={180}
        className="mx-auto mb-6"
      />
      <h2 className="text-3xl font-bold mb-6 text-brown-dark">Meet Carter &amp; Augie</h2>
      <p className="text-brown/60 text-lg leading-relaxed mb-4">
        Just two dudes who&apos;d rather be outside washing cars than sitting in a classroom.
        We bring the soap, towels, and good vibes — all we need from you is a hose bib and an outdoor outlet.
        Park it in the driveway and we&apos;ll handle the rest.
      </p>
      <p className="text-brown/60 text-lg leading-relaxed">
        Every wash is done by hand. No machines, no shortcuts.
        We actually care about doing it right. 🤝
      </p>
    </section>
  );
}
