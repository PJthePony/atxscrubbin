import Nav from "@/components/homepage/Nav";
import Hero from "@/components/homepage/Hero";
import HowItWorks from "@/components/homepage/HowItWorks";
import Pricing from "@/components/homepage/Pricing";
import ServiceAreaPreview from "@/components/homepage/ServiceAreaPreview";
import About from "@/components/homepage/About";
import Contact from "@/components/homepage/Contact";
import Footer from "@/components/homepage/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-cream text-brown-dark">
      <Nav />
      <Hero />
      <HowItWorks />
      <Pricing />
      <ServiceAreaPreview />
      <About />
      <Contact />
      <Footer />
    </div>
  );
}
