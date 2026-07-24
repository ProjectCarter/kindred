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
      "Concerts, festivals, markets, and community nights — the best of what's happening today, hand-picked and verified.",
  },
  {
    emoji: "🍔",
    title: "Food & Drinks",
    description:
      "Neighborhood restaurants, coffee shops, and breweries worth leaving the house for — local favorites over chains.",
  },
  {
    emoji: "🌲",
    title: "Activities",
    description:
      "Trails, escape rooms, kayaking, mini golf, and hidden gems that turn an ordinary day into a great one.",
  },
  {
    emoji: "📰",
    title: "Local News",
    description:
      "What's actually happening in your city, written like a calm morning paper — clear, factual, and worth your time.",
  },
  {
    emoji: "🌎",
    title: "National News",
    description:
      "The day's essential national stories, edited down to what matters — no outrage, no endless feed.",
  },
  {
    emoji: "🎨",
    title: "Today's Masterpiece",
    description:
      "A single work of art each day with the story behind it — a small, beautiful moment of culture.",
  },
  {
    emoji: "🏛️",
    title: "History Around Town",
    description:
      "The people and places that shaped your city, told in short, memorable pieces you'll actually remember.",
  },
  {
    emoji: "☀️",
    title: "Weather",
    description:
      "A clean, glanceable forecast built into your morning read — so you know exactly how to plan the day.",
  },
];

export default function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-24 sm:py-32">
      <div className="container-kindred">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="eyebrow">One edition, everything local</span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-5 font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl dark:text-[#F4F2FA]">
              Everything worth knowing, beautifully edited
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 text-lg text-ink-muted dark:text-[#B7B3C6]">
              Eight desks, one daily edition. Each section is curated like a real
              newspaper — trustworthy, relevant, and genuinely useful.
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
