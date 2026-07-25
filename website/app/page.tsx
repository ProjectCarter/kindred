import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import WhyKindred from "@/components/WhyKindred";
import ComingSoon from "@/components/ComingSoon";
import Footer from "@/components/Footer";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kindred",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "iOS, Android",
  description:
    "Kindred is a premium local discovery app that helps you discover events, activities, food & drinks, weather, local history, today's masterpiece, today in history, and exclusive local deals happening around you every day.",
  url: "https://www.discoverkindred.com",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Nav />
      <main id="main">
        <Hero />
        <Features />
        <WhyKindred />
        <ComingSoon />
      </main>
      <Footer />
    </>
  );
}
