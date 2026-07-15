/**
 * Reader-facing editorial voice — engine language stays inside the desk,
 * never in the morning paper.
 */

export const ENGINE_LANGUAGE_PATTERN =
  /\b(verified listing|category guess|confidence score|source confidence|category detection|selected because|kindred flagged|kindred selected|algorithmic suggestion|algorithmic recommendation|ai verified|foursquare verified|evidence gate|experience verified|verified near|verified through|not a category|category suggestion|category recommendation|confirmed listing|quiet desk recommendation|fits your place|editorial quality|hand-selected|we could confirm|grounded in what|not a line-by-line review|kindred doesn'?t have|kindred can (actually )?verify|worth a look before the day fills|today'?s notebook on editorial judgment|trending list|mood board version|earned a place in today'?s paper|from today'?s paper)\b/i;

export function containsEngineLanguage(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return ENGINE_LANGUAGE_PATTERN.test(text.trim());
}

/** Scoring reason codes that must never surface as reader-facing "why" copy. */
export const INTERNAL_REASON_CODES = new Set([
  "editorial_quality",
  "trusted_source",
  "reader_interest",
  "followed_topic",
  "favorite_source",
  "chain_deprioritized",
  "low_value_venue",
  "not_participatory",
  "proximity_far_nps",
  "nps_low_confidence",
  "season_mismatch",
  "weather_mismatch",
]);
