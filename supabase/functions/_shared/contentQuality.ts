/**
 * Edge content quality — reject placeholders / city mismatches.
 */

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /editorial quality worthy of a magazine desk/i,
  /matches what you tend to care about/i,
  /third-wave caf[eé]/i,
  /hand-selected for today'?s paper/i,
  /a quiet suggestion from bandit/i,
  /bbc\s*\/\s*the economist/i,
  /nat geo[–\-]?style/i,
  /the kind of calm gloss/i,
  /magazine desk energy/i,
];

export function isPlaceholderCopy(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(text));
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** True when copy is editorial prose, not a placeholder stub. */
export function hasSubstance(
  text: string | null | undefined,
  minWords = 18
): boolean {
  if (!text?.trim()) return false;
  if (isPlaceholderCopy(text)) return false;
  return wordCount(text) >= minWords;
}

export function normalizeCity(city: string | null | undefined): string {
  return (city ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function cityAppearsInText(
  city: string,
  text: string | null | undefined
): boolean {
  const c = normalizeCity(city);
  if (!c || !text) return false;
  return normalizeCity(text).includes(c);
}

/**
 * Reject SerpApi events that clearly belong to another metro entirely.
 *
 * This is a safety net, not a same-city gate: a "Events in {city}" query
 * already asks Google for locally-relevant results, and most towns are
 * one metro among several nearby suburbs (a Gilbert, AZ resident cares
 * about Phoenix, Mesa, Chandler, and Tempe events too). Requiring the
 * event's city field to literally equal the query city discarded almost
 * everything for suburb-sized queries — this only screens out results
 * that drifted to a well-known, unrelated big-city metro.
 */
export function eventMatchesCity(
  eventCity: string | null | undefined,
  eventVenue: string | null | undefined,
  eventName: string | null | undefined,
  expectedCity: string
): boolean {
  const expected = normalizeCity(expectedCity);
  if (!expected) return false;

  const blob = normalizeCity(
    [eventCity, eventVenue, eventName].filter(Boolean).join(" ")
  );

  // Explicit match on expected city
  if (blob.includes(expected)) return true;

  // Well-known, unrelated big-city metros — a clear sign the result
  // drifted away from the requested search, not a same-region suburb.
  const FOREIGN_METROS = [
    "san francisco",
    "san francisco bay",
    "oakland",
    "berkeley",
    "san jose",
    "new york",
    "los angeles",
    "seattle",
    "chicago",
    "boston",
    "miami",
    "austin",
    "denver",
    "portland",
    "london",
    "tokyo",
  ];

  for (const metro of FOREIGN_METROS) {
    if (metro === expected) continue;
    if (blob.includes(metro)) return false;
  }

  // Anything else — including nearby suburbs Google already judged
  // relevant to the query, or listings with no city field at all — passes.
  return true;
}
