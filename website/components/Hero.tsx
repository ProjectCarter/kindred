import Reveal from "./Reveal";
import PhoneMockup from "./PhoneMockup";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32 lg:pt-40">
      {/* Ambient gradient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(194,169,239,0.35),transparent)] blur-2xl dark:bg-[radial-gradient(closest-side,rgba(142,99,214,0.28),transparent)]" />
        <div className="absolute right-[8%] top-[30%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(closest-side,rgba(216,166,58,0.18),transparent)] blur-2xl" />
        <div className="absolute left-[6%] top-[45%] h-[240px] w-[240px] rounded-full bg-[radial-gradient(closest-side,rgba(194,169,239,0.22),transparent)] blur-2xl" />
      </div>

      <div className="container-kindred">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Your daily local edition
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 font-serif text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl dark:text-[#F4F2FA]">
              Discover what&rsquo;s{" "}
              <span className="bg-gradient-to-r from-lilac-500 via-lilac-400 to-gold bg-clip-text text-transparent">
                happening around you.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted sm:text-xl dark:text-[#B7B3C6]">
              Kindred brings together local events, food &amp; drinks, activities,
              history, weather, and news into one beautiful daily experience.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#coming-soon" className="btn btn-primary w-full sm:w-auto">
                Coming Soon
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="#features" className="btn btn-secondary w-full sm:w-auto">
                Learn More
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-6 text-sm text-ink-muted dark:text-[#8E8AA0]">
              No noise. No doomscrolling. Just your city, beautifully edited each morning.
            </p>
          </Reveal>
        </div>

        {/* Device preview */}
        <Reveal delay={200} className="mt-16 sm:mt-20">
          <div className="relative mx-auto max-w-5xl">
            <div className="card-surface relative overflow-hidden rounded-5xl px-6 pt-10 sm:px-12 sm:pt-14">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-lilac-50/60 to-transparent dark:from-lilac-500/[0.06]" />
              <div className="grid items-end gap-8 sm:grid-cols-[1fr_auto_1fr]">
                <div className="hidden text-left sm:block">
                  <p className="font-serif text-sm italic text-ink-muted dark:text-[#B7B3C6]">
                    &ldquo;Tuesday, in your neighborhood&rdquo;
                  </p>
                  <div className="mt-4 space-y-3">
                    <MiniRow emoji="🎉" title="Live music at Riverside Park" />
                    <MiniRow emoji="🍔" title="A new taco spot worth the drive" />
                    <MiniRow emoji="🌲" title="Golden-hour trail near you" />
                  </div>
                </div>

                <PhoneMockup
                  src="/screenshots/edition-home.svg"
                  alt="Preview of the Kindred daily edition home screen"
                  className="animate-float"
                  priority
                />

                <div className="hidden text-left sm:block">
                  <div className="space-y-3">
                    <MiniRow emoji="☀️" title="72° and clear all afternoon" />
                    <MiniRow emoji="🏛️" title="The story behind Main Street" />
                    <MiniRow emoji="🎨" title="Today's Masterpiece" />
                  </div>
                  <p className="mt-4 font-serif text-sm italic text-ink-muted dark:text-[#B7B3C6]">
                    Everything, in one calm read.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function MiniRow({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink/[0.05] bg-white/70 px-3.5 py-2.5 text-sm shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
      <span aria-hidden="true" className="text-base">
        {emoji}
      </span>
      <span className="font-medium text-ink-soft dark:text-[#C7C4D4]">{title}</span>
    </div>
  );
}
