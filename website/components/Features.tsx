import Reveal from "./Reveal";

type Feature = {
  emoji: string;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    emoji: "🎉",
    title: "Local Events",
    description:
      "Discover concerts, festivals, markets, sports, and the best things happening around you today.",
  },
  {
    emoji: "🍔",
    title: "Food & Drinks",
    description:
      "Find great local restaurants, cafés, breweries, wine bars, and neighborhood favorites worth visiting.",
  },
  {
    emoji: "🌲",
    title: "Activities",
    description:
      "Discover hikes, kayaking, pickleball, escape rooms, golf, parks, and other fun things to do nearby.",
  },
  {
    emoji: "☀️",
    title: "Weather",
    description:
      "A beautiful morning forecast that helps you plan your day at a glance.",
  },
  {
    emoji: "🏛",
    title: "History Around Town",
    description:
      "Discover the stories behind landmarks, neighborhoods, monuments, and places you pass every day.",
  },
  {
    emoji: "📜",
    title: "Today in History",
    description:
      "Interesting historical moments from this day, presented in a quick, enjoyable daily read.",
  },
  {
    emoji: "🖼",
    title: "Today's Masterpiece",
    description:
      "Experience one remarkable work of art every morning along with the story behind it.",
  },
  {
    emoji: "💰",
    title: "Local Deals",
    description:
      "Save money with exclusive local offers, discounts, affiliate deals, and promotions from businesses near you.",
  },
];

export default function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-24 sm:py-32">
      <div className="container-kindred">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">Everything local, in one place</span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-5 font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl dark:text-[#F4F2FA]">
              Everything worth doing, beautifully organized
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 text-lg text-ink-muted dark:text-[#B7B3C6]">
              Eight ways to explore your city, brought together in one beautifully
              organized daily experience — curated, trustworthy, and genuinely useful.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 4) * 80}>
              <article className="card-surface group h-full p-6 hover:-translate-y-1 hover:shadow-lift">
                <span
                  aria-hidden="true"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-lilac-50 to-lilac-100 text-2xl transition-transform duration-500 group-hover:scale-110 dark:from-lilac-500/15 dark:to-lilac-500/5"
                >
                  {feature.emoji}
                </span>
                <h3 className="mt-5 font-serif text-xl font-semibold text-ink dark:text-[#F4F2FA]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted dark:text-[#B7B3C6]">
                  {feature.description}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
