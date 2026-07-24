"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("kindred-theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      aria-pressed={mounted ? isDark : undefined}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white/70 text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-lilac-300 hover:text-lilac-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream dark:border-white/10 dark:bg-white/5 dark:text-[#ECEAF3] dark:hover:text-lilac-200"
    >
      {/* Sun / Moon rendered based on state; hidden until mounted to avoid mismatch */}
      <span className="sr-only">Toggle color theme</span>
      {mounted && isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.95 6.95-1.41-1.41M6.46 6.46 5.05 5.05m12.9 0-1.41 1.41M6.46 17.54l-1.41 1.41"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
