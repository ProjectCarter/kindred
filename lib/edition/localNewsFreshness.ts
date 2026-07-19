/**
 * Local News freshness — fetch window, age helpers, press-wire detection.
 * Desk priority selection lives in `localNewsDesk.ts`.
 */

/** NewsAPI `everything` lookback for local / fallback queries. */
export const LOCAL_NEWS_FETCH_WINDOW_DAYS = 7;

/** Local News + fallback leads must be within 24 hours. */
export const LOCAL_NEWS_PREFERRED_MAX_HOURS = 24;

/** Hard ceiling for candidate fetch post-filter. */
export const LOCAL_NEWS_MAX_LEAD_AGE_DAYS = 7;

export const LOCAL_NEWS_MAX_LEAD_AGE_HOURS =
  LOCAL_NEWS_MAX_LEAD_AGE_DAYS * 24;

const PRESS_RELEASE_SOURCE_HINTS = [
  "prnewswire",
  "pr news wire",
  "globe newswire",
  "globenewswire",
  "business wire",
  "businesswire",
  "accesswire",
  "ein presswire",
  "newswire",
  "press release",
];

const PRESS_RELEASE_URL_HINTS = [
  "prnewswire.com",
  "globenewswire.com",
  "businesswire.com",
  "accesswire.com",
  "einpresswire.com",
];

export function isPressReleaseWire(input: {
  source?: string | null;
  url?: string | null;
}): boolean {
  const source = (input.source ?? "").toLowerCase();
  const url = (input.url ?? "").toLowerCase();
  if (PRESS_RELEASE_SOURCE_HINTS.some((h) => source.includes(h))) return true;
  if (PRESS_RELEASE_URL_HINTS.some((h) => url.includes(h))) return true;
  return false;
}

/** NewsAPI `from` date (YYYY-MM-DD) for the local everything query. */
export function localNewsFetchFromDate(now: Date = new Date()): string {
  const from = new Date(now.getTime());
  from.setUTCDate(from.getUTCDate() - LOCAL_NEWS_FETCH_WINDOW_DAYS);
  return from.toISOString().slice(0, 10);
}

export function hoursSincePublished(
  publishedAt: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!publishedAt?.trim()) return null;
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (now.getTime() - ms) / 3_600_000);
}

export type LocalLeadAgeBand = "preferred" | "within_week" | "stale" | "unknown";

/** Age bands for diagnostics — preferred = within the 24h desk window. */
export function localLeadAgeBand(
  publishedAt: string | null | undefined,
  now: Date = new Date()
): LocalLeadAgeBand {
  const hours = hoursSincePublished(publishedAt, now);
  if (hours === null) return "unknown";
  if (hours <= LOCAL_NEWS_PREFERRED_MAX_HOURS) return "preferred";
  if (hours <= LOCAL_NEWS_MAX_LEAD_AGE_HOURS) return "within_week";
  return "stale";
}
