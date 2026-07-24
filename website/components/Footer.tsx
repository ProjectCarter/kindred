import Logo from "./Logo";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink/[0.06] py-14 dark:border-white/[0.06]">
      <div className="container-kindred">
        <div className="flex flex-col items-start justify-between gap-10 sm:flex-row">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-ink-muted dark:text-[#B7B3C6]">
              Your personalized local morning newspaper — events, food, activities,
              history, weather, and stories from around you, every day.
            </p>
            <a
              href="mailto:hello@discoverkindred.com"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-lilac-600 transition-colors hover:text-lilac-500 dark:text-lilac-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              hello@discoverkindred.com
            </a>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-3 sm:flex sm:flex-col">
            <a href="/privacy" className="text-sm font-medium text-ink-soft transition-colors hover:text-lilac-600 dark:text-[#C7C4D4] dark:hover:text-lilac-200">
              Privacy Policy
            </a>
            <a href="/terms" className="text-sm font-medium text-ink-soft transition-colors hover:text-lilac-600 dark:text-[#C7C4D4] dark:hover:text-lilac-200">
              Terms of Service
            </a>
            <a href="mailto:hello@discoverkindred.com" className="text-sm font-medium text-ink-soft transition-colors hover:text-lilac-600 dark:text-[#C7C4D4] dark:hover:text-lilac-200">
              Contact
            </a>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-ink/[0.06] pt-8 text-sm text-ink-muted sm:flex-row dark:border-white/[0.06] dark:text-[#8E8AA0]">
          <p>&copy; {year} Kindred. All rights reserved.</p>
          <p>
            <a href="https://discoverkindred.com" className="transition-colors hover:text-lilac-600 dark:hover:text-lilac-200">
              discoverkindred.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
