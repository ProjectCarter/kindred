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

/** Reject SerpApi events that clearly belong to another metro. */
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

  // Common wrong-city markers when expecting Phoenix
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

  // If event city field is empty, keep (SerpApi often omits city when query is local)
  if (!eventCity?.trim()) return true;

  // Different explicit city → reject
  return normalizeCity(eventCity) === expected ||
    normalizeCity(eventCity).includes(expected) ||
    expected.includes(normalizeCity(eventCity));
}
