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
      <h2 className="text-3xl font-bold mb-6 text-brown-dark">Meet Carter, Augie &amp; Tucker</h2>
      <p className="text-brown/60 text-lg leading-relaxed mb-4">
        Just three guys who take pride in making your car look its best.
        We bring the supplies, the energy, and the attention to detail.
        You just provide a hose bib and an outlet.
      </p>
      <p className="text-brown/60 text-lg leading-relaxed">
        Every wash is done by hand with the right tools. No shortcuts, just care. 🤝
      </p>
    </section>
  );
}
