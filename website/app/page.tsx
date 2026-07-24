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
    "Kindred is your personalized local morning newspaper that helps you discover events, activities, restaurants, history, weather, and local stories happening around you every day.",
  url: "https://discoverkindred.com",
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
