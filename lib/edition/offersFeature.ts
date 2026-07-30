/**
 * Offers — homepage surface gate.
 *
 * The Offers desk (internally "Local Deals") is controlled by this single flag,
 * the same per-feature pattern used by `newsSectionsFeature` and
 * `banditsPicksFeature`. This is the existing feature-control system — not a
 * second one.
 *
 * When `OFFERS_ENABLED` is true, the homepage renders the Offers section only if
 * the anon-readable `deals_published` projection actually has live offers;
 * an empty catalog still hides the section (see `LocalDealsSection`).
 *
 * What stays on while this flag is true:
 * - Homepage Offers section, See All (`/deals`), and Offer detail (`/deal/[id]`)
 * - The `deals_published` read path (featured + count + detail hooks)
 *
 * What stays off when this flag is false:
 * - Homepage Offers section render (so no featured/count queries fire on open)
 * - The only homepage entry points into `/deals` and `/deal/[id]`
 * - Everything else in the app is unaffected
 *
 * Internal code, routes, tables, and types intentionally keep the stable "deal"
 * naming; only the reader-facing wording says "Offers".
 */

/** Offers homepage desk enabled. Flip to false to hide the section safely. */
export const OFFERS_ENABLED = true;

export function isOffersEnabled(): boolean {
  return OFFERS_ENABLED;
}
