import type { ReactNode } from "react";
import Nav from "./Nav";
import Footer from "./Footer";

type LegalPageProps = {
  title: string;
  updated: string;
  children: ReactNode;
};

export default function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <>
      <Nav />
      <main id="main" className="pt-32 pb-24 sm:pt-40">
        <article className="container-kindred max-w-3xl">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-lilac-600 transition-colors hover:text-lilac-500 dark:text-lilac-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5m6 6-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to home
          </a>
          <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl dark:text-[#F4F2FA]">
            {title}
          </h1>
          <p className="mt-3 text-sm text-ink-muted dark:text-[#8E8AA0]">
            Last updated {updated}
          </p>
          <div className="prose-kindred mt-10 space-y-6 text-ink-soft dark:text-[#C7C4D4]">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl font-semibold text-ink dark:text-[#F4F2FA]">
        {heading}
      </h2>
      <div className="space-y-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}
