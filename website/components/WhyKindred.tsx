import Reveal from "./Reveal";

const scattered = [
  "Events app",
  "Restaurant reviews",
  "Trail finder",
  "Weather app",
  "Local deals",
  "City history",
  "Daily masterpiece",
  "Things to do",
];

const points = [
  {
    title: "One calm read, every morning",
    description:
      "Your city, curated into one beautiful daily experience. Open it with your coffee and you'll know what's worth doing today.",
  },
  {
    title: "Curated, not endless",
    description:
      "No infinite scroll. No noise. Just the handful of things genuinely worth your attention today.",
  },
  {
    title: "Local and trustworthy",
    description:
      "Real events, real places, verified details — the kind of recommendations you'd give a good friend.",
  },
];

export default function WhyKindred() {
  return (
    <section id="why" className="scroll-mt-24 py-24 sm:py-32">
      <div className="container-kindred">
        <div className="card-surface overflow-hidden rounded-5xl">
          <div className="grid items-center gap-12 p-8 sm:p-12 lg:grid-cols-2 lg:p-16">
            {/* Left: the story */}
            <div>
              <Reveal>
                <span className="eyebrow">Why Kindred</span>
              </Reveal>
              <Reveal delay={80}>
                <h2 className="mt-5 font-serif text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl dark:text-[#F4F2FA]">
                  Ten apps every morning. Or one.
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="mt-5 text-lg leading-relaxed text-ink-muted dark:text-[#B7B3C6]">
                  Most mornings mean bouncing between a dozen apps just to figure out
                  what&rsquo;s happening around you. Kindred combines all of it into one
                  beautifully designed daily experience — so discovering your city feels
                  effortless again.
                </p>
              </Reveal>

              <div className="mt-8 space-y-5">
                {points.map((point, i) => (
                  <Reveal key={point.title} delay={200 + i * 90}>
                    <div className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lilac-300 to-lilac-500 text-cream"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div>
                        <h3 className="font-semibold text-ink dark:text-[#F4F2FA]">{point.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink-muted dark:text-[#B7B3C6]">
                          {point.description}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Right: scattered → unified visual */}
            <Reveal delay={160}>
              <div className="relative">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {scattered.map((label) => (
                    <div
                      key={label}
                      className="flex items-center justify-center rounded-2xl border border-ink/[0.06] bg-white/60 px-3 py-4 text-center text-xs font-medium text-ink-muted opacity-70 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-[#8E8AA0]"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-lilac-400 to-lilac-500 px-5 py-5 text-cream shadow-glow">
                  <span aria-hidden="true" className="text-2xl">📖</span>
                  <div>
                    <p className="font-serif text-lg font-semibold">Kindred</p>
                    <p className="text-xs text-cream/80">All of it, in one app.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
