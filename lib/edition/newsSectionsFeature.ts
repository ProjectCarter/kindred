/**
 * Local News + National News — Version 1 surface gate.
 *
 * Product decision (V1): hide both news desks from the homepage and skip
 * news generation during edition build while discovery desks are polished.
 *
 * What stays on while this flag is false:
 * - All types, adapters, article readers, Story Editor, and DB columns
 * - Today's Masterpiece + Today in History (shared U.S. national daily layer)
 * - Local Deals placeholder in the former news folio position
 *
 * What stays off:
 * - Homepage Local News / National News render
 * - Client national-news hydration and backfill network calls
 * - Edition build local_news stage + National News attach/generation
 * - News desk validation, completeness, and quality scoring
 *
 * Re-enable for V2/V3: set `ENABLE_NEWS_SECTIONS` to `true` here and in
 * the server mirror (`supabase/functions/_shared/edition/newsSectionsFeature.ts`).
 */

/** V1 news desks hidden — not a permanent removal of the feature. */
export const ENABLE_NEWS_SECTIONS = false;

export function isNewsSectionsEnabled(): boolean {
  return ENABLE_NEWS_SECTIONS;
}
