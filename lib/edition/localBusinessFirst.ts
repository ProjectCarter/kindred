/**
 * Local Business First — permanent Kindred identity and editorial ranking law.
 * Applies to Activities, Recommendations, Food & Drinks, Bandit's Pick, and
 * every future discovery desk in every U.S. city edition.
 *
 * Keep in sync with:
 * - `.cursor/rules/kindred-local-business-first.mdc`
 * - `supabase/functions/_shared/editorial/localBusinessFirst.ts`
 */

/** Compact digest for AI prompts and engineering documentation. */
export const LOCAL_BUSINESS_FIRST_DIGEST = `
LOCAL BUSINESS FIRST (permanent Kindred identity — every city, every desk):

Kindred exists to help people experience the unique character of a city.

- When comparable quality, verification, and trust exist, prioritize independently
  owned local businesses over national chains.
- Local restaurants, coffee shops, bakeries, breweries, wineries, taco shops,
  BBQ, pizza, diners, bookstores, and specialty stores define a city's identity.
- Chains remain allowed — never excluded entirely — but usually as fallback picks,
  not the face of the local experience.
- A visitor does not travel to a city for McDonald's. They travel for that city's
  taco shop, neighborhood coffee, seafood, brewery, or family-owned hidden gem.
- Extend beyond restaurants whenever appropriate — highlight what gives a city personality.

Google Maps answers: "What's nearby?"
Kindred answers: "What's worth experiencing?"

Editorial ranking rule: when quality, verification, and trust are comparable,
give editorial preference to verified independent local businesses over chains.
Never fabricate local status. Never unfairly suppress chains.
`.trim();

/** Pre-surface editorial questions — discovery curation and ranking. */
export const LOCAL_BUSINESS_FIRST_QUESTIONS = [
  "Does this help someone experience this city's unique character?",
  "If a comparable verified independent local option exists, does this pick still earn its place on merit?",
  "Would an experienced local editor recommend this to a visitor — not just someone looking for the nearest chain?",
  "Google Maps answers what's nearby — does this answer what's worth experiencing?",
] as const;

/** Permanent ranking tie-breaker when editorial quality is otherwise comparable. */
export const LOCAL_BUSINESS_FIRST_RANKING_RULE =
  "When quality, verification, and trust are comparable, independently owned local businesses receive editorial preference over national chains.";
