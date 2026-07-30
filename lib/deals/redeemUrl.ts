/**
 * Redeem-URL validation — pure, import-free, unit-testable.
 *
 * The affiliate tracking URL is treated as an opaque, exact string. We never
 * rebuild it, never append parameters, and never strip tracking — we only
 * confirm it is a well-formed http(s) link that is safe to hand to the OS
 * browser. Any offer whose stored `redeemUrl` is missing or malformed is simply
 * not redeemable (the UI hides the button rather than opening something unsafe).
 */

/**
 * Return the exact, unmodified redeem URL when it is a safe, openable http(s)
 * link; otherwise null. The returned string is byte-identical to the stored
 * value (only surrounding whitespace is ignored) — no rewriting, no extra
 * query parameters, no affiliate-URL reconstruction.
 */
export function normalizeRedeemUrl(
  raw: string | null | undefined
): string | null {
  const url = raw?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** True when an offer has a redeem URL we can safely open in the browser. */
export function isRedeemableUrl(raw: string | null | undefined): boolean {
  return normalizeRedeemUrl(raw) !== null;
}
