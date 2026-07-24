import Reveal from "./Reveal";

export default function ComingSoon() {
  return (
    <section id="coming-soon" className="scroll-mt-24 py-24 sm:py-32">
      <div className="container-kindred">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-5xl bg-ink px-6 py-16 text-center shadow-lift sm:px-12 sm:py-20 dark:bg-[#15161d]">
          {/* Ambient glow */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-30%] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(142,99,214,0.4),transparent)] blur-2xl" />
            <div className="absolute bottom-[-20%] right-[10%] h-[240px] w-[240px] rounded-full bg-[radial-gradient(closest-side,rgba(216,166,58,0.22),transparent)] blur-2xl" />
          </div>

          <div className="relative">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-cream/15 bg-cream/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-lilac-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
                Launching soon
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h2 className="mx-auto mt-6 max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight text-cream sm:text-5xl">
                Coming Soon to iPhone &amp; Android
              </h2>
            </Reveal>

            <Reveal delay={140}>
              <p className="mx-auto mt-4 max-w-xl text-lg text-cream/70">
                Kindred is putting the finishing touches on your city&rsquo;s first
                edition. Be the first to know the moment it goes live.
              </p>
            </Reveal>

            <Reveal delay={220}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <StoreBadge platform="ios" />
                <StoreBadge platform="android" />
              </div>
            </Reveal>

            <Reveal delay={300}>
              <form
                className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
                action="#"
                aria-label="Get notified when Kindred launches"
              >
                <label htmlFor="notify-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="notify-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-full border border-cream/15 bg-cream/5 px-5 py-3 text-sm text-cream placeholder:text-cream/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-300"
                />
                <button type="submit" className="btn shrink-0 bg-lilac-300 text-ink hover:bg-lilac-200">
                  Notify me
                </button>
              </form>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoreBadge({ platform }: { platform: "ios" | "android" }) {
  const isIos = platform === "ios";
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-cream/15 bg-cream/[0.06] px-5 py-3 text-left text-cream backdrop-blur transition-colors hover:border-lilac-300/50">
      <span aria-hidden="true" className="text-cream">
        {isIos ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.99-.79.9-2.06 1.6-3.14 1.51-.14-1.1.41-2.28 1.06-3.01.72-.83 2.03-1.46 3.2-1.49ZM20.6 17.02c-.55 1.27-.81 1.83-1.52 2.95-1 1.57-2.4 3.53-4.14 3.54-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.74-.01-3.07-1.78-4.06-3.35-2.77-4.37-3.06-9.5-1.35-12.22 1.21-1.93 3.13-3.06 4.93-3.06 1.84 0 3 1.01 4.52 1.01 1.48 0 2.38-1.01 4.51-1.01 1.61 0 3.31.88 4.53 2.39-3.98 2.18-3.33 7.86.68 9.75Z" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.6 20.5 13 12 3.6 3.5c-.2.15-.35.4-.35.75v15.5c0 .35.15.6.35.75Zm10.9-7 2.9 2.9-9.7 5.5 6.8-8.4Zm0-3-6.8-8.4 9.7 5.5-2.9 2.9ZM17.7 9.6l3 1.7c.7.4.7 1.4 0 1.8l-3 1.7-3.2-3.2 3.2-3.2Z" />
          </svg>
        )}
      </span>
      <span>
        <span className="block text-[0.65rem] uppercase tracking-wide text-cream/60">
          {isIos ? "Soon on the" : "Soon on"}
        </span>
        <span className="block text-sm font-semibold">
          {isIos ? "App Store" : "Google Play"}
        </span>
      </span>
    </div>
  );
}
