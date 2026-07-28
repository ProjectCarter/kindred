/**
 * Deal count presentation.
 *
 * Counts are bucketed so the number never churns for the reader:
 *   0        → hide the section entirely (caller checks `shouldShowDeals`)
 *   1–99     → the exact number
 *   100+     → "100+"
 */

/** True once at least one deal is available. */
export function shouldShowDeals(count: number): boolean {
  return Number.isFinite(count) && count > 0;
}

/** Bucketed count string, e.g. "1", "42", "100+". */
export function formatDealCount(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n >= 100) return "100+";
  return String(n);
}

/** Full "See all N deals" label with correct singular/plural + bucketing. */
export function dealsSeeAllLabel(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n >= 100) return "See all 100+ deals";
  return `See all ${n} ${n === 1 ? "deal" : "deals"}`;
}
