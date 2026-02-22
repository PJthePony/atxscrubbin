import Image from "next/image";

const steps = [
  {
    step: "1",
    title: "Pick Your Wash",
    desc: "Choose your car size and throw on any add-ons you want.",
    image: "/step-pick.png",
    alt: "Cowboy sponge and spray bottle riding bikes",
  },
  {
    step: "2",
    title: "Choose a Time",
    desc: "Pick a day and time — we'll be there on the dot.",
    image: "/step-schedule.png",
    alt: "Spray bottle mascot holding a calendar",
  },
  {
    step: "3",
    title: "We Come to You",
    desc: "We roll up, scrub it down, and leave your car looking fresh.",
    image: "/step-wash.png",
    alt: "Cowboy sponge and spray bottle leaning on a truck",
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
            <div className="flex justify-center mb-4">
              <Image
                src={item.image}
                alt={item.alt}
                width={180}
                height={180}
                className="object-contain"
              />
            </div>
            <h3 className="text-xl font-bold mb-2 text-brown-dark">{item.title}</h3>
            <p className="text-brown/60 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
