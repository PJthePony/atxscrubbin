const steps = [
  {
    step: "1",
    title: "Pick Your Wash",
    desc: "Choose your car size and throw on any add-ons you want.",
    emoji: "🧽",
  },
  {
    step: "2",
    title: "Choose a Time",
    desc: "Pick a day and time — we'll be there on the dot.",
    emoji: "📅",
  },
  {
    step: "3",
    title: "We Come to You",
    desc: "We roll up, scrub it down, and leave your car looking fresh.",
    emoji: "🤠",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-3 text-brown-dark">How It Works</h2>
      <p className="text-center text-brown/60 mb-16 max-w-lg mx-auto">
        Three steps. That&apos;s literally it.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {steps.map((item) => (
          <div key={item.step} className="text-center">
            <div className="text-5xl mb-4">{item.emoji}</div>
            <h3 className="text-xl font-bold mb-2 text-brown-dark">{item.title}</h3>
            <p className="text-brown/60 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
