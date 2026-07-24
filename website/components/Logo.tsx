type LogoProps = {
  className?: string;
  showWordmark?: boolean;
};

/** Kindred brand mark — a simple sunrise-over-page glyph paired with the wordmark. */
export default function Logo({ className = "", showWordmark = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden="true"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-lilac-300 to-lilac-500 shadow-[0_6px_16px_-6px_rgba(142,99,214,0.6)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 16h16M6 16a6 6 0 0 1 12 0"
            stroke="#FDFCF9"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M12 5v3M6.5 7.5l1.5 1.5M17.5 7.5 16 9" stroke="#FDFCF9" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-serif text-xl font-semibold tracking-tight text-ink dark:text-[#F4F2FA]">
          Kindred
        </span>
      )}
    </span>
  );
}
