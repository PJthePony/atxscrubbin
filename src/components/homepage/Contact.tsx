export default function Contact() {
  return (
    <section id="contact" className="px-6 py-24 max-w-3xl mx-auto text-center">
      <h2 className="text-3xl font-bold mb-3 text-brown-dark">Hit Us Up</h2>
      <p className="text-brown/60 mb-10">
        Questions? Wanna talk about your car? Just say hey.
      </p>
      <div className="flex justify-center">
        <a
          href="mailto:keepaustinscrubbin@gmail.com"
          className="flex items-center justify-center gap-3 rounded-2xl border-2 border-brown/15 px-8 py-5 transition hover:border-orange"
        >
          <span className="text-xl">✉️</span>
          <span className="text-brown/70">keepaustinscrubbin@gmail.com</span>
        </a>
      </div>
    </section>
  );
}
