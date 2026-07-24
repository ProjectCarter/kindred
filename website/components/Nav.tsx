"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "#features", label: "Features" },
  { href: "#why", label: "Why Kindred" },
  { href: "#coming-soon", label: "Coming Soon" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-ink/[0.06] bg-cream/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#0E0F14]/80"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="container-kindred flex h-16 items-center justify-between sm:h-18">
        <a href="#top" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-400">
          <Logo />
          <span className="sr-only">Kindred home</span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-lilac-600 dark:text-[#C7C4D4] dark:hover:text-lilac-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <a href="#coming-soon" className="btn btn-primary hidden sm:inline-flex">
            Get early access
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 text-ink md:hidden dark:border-white/10 dark:text-[#ECEAF3]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {open ? (
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-ink/[0.06] bg-cream/95 backdrop-blur-xl md:hidden dark:border-white/[0.06] dark:bg-[#0E0F14]/95">
          <div className="container-kindred flex flex-col gap-1 py-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-ink-soft transition-colors hover:bg-lilac-50 hover:text-lilac-600 dark:text-[#C7C4D4] dark:hover:bg-white/5"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#coming-soon"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-2 w-full"
            >
              Get early access
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
