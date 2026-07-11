/**
 * Calendar date for the reader's local morning — not UTC.
 * Editions are keyed by the day the reader experiences, not the server's clock.
 */
export function localEditionDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Basic email shape check before OTP — avoids useless round-trips. */
export function isPlausibleEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // Practical, not RFC-complete — good enough for magic-link gating.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
