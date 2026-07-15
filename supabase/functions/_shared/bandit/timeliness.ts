/**
 * Bandit's Pick timeliness — "What's Special Right Now" vs timeless Recommendations.
 */

/** Networking, hiring, conferences, and generic promotions never belong here. */
export const BANDIT_DISQUALIFY_PATTERN =
  /\b(networking event|networking night|job fair|hiring event|career fair|trade show|business conference|industry conference|vendor expo|professional development|resume workshop|recruiting event|b2b expo|sweepstakes|%\s*off|limited time offer|buy one get|clearance sale|grand opening sale|free seminar|lead generation|mlm|multi[- ]level)\b/i;

/** Seasonal, limited-time, and right-now signals Bandit should notice. */
export const BANDIT_TIMELY_PATTERN =
  /\b(season|seasonal|harvest|peak bloom|in bloom|festival|county fair|state fair|bloom|blooms|blossom|cherry blossom|wildflower|lavender|firefly|fireflies|meteor|perseid|star shower|farmer.?s market|market day|pumpkin patch|apple cider|apple picking|cider donut|corn maze|hayride|christmas lights|holiday lights|light display|tree lighting|holiday market|winter market|summer market|opening weekend|last chance|final week|this weekend|only through|limited run|temporary exhibit|pop[- ]up|foliage|leaf peep|peak color|blueberry|strawberry|peach season|tomato season|peach cobbler|shaded trail|cool morning)\b/i;

export function hasBanditTimelySignal(text: string): boolean {
  const hay = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!hay) return false;
  return BANDIT_TIMELY_PATTERN.test(hay);
}

export function isDisqualifiedBanditPickCandidate(text: string): boolean {
  const hay = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!hay) return true;
  return BANDIT_DISQUALIFY_PATTERN.test(hay);
}

/** Days until an ISO datetime; null when unparseable. */
export function daysUntil(iso: string, now: Date): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - now.getTime()) / 86_400_000);
}

/** True when the event falls within the editorial planning window. */
export function isHappeningSoon(
  iso: string,
  now: Date,
  withinDays = 30
): boolean {
  const days = daysUntil(iso, now);
  if (days == null) return false;
  return days >= 0 && days <= withinDays;
}
