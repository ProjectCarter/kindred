/**
 * Lightweight entity / topic extraction from headlines —
 * enough to connect stories to knowledge facets without a heavy NLP stack.
 */

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "at",
  "from",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "after",
  "before",
  "over",
  "under",
  "into",
  "about",
  "says",
  "said",
  "new",
  "amid",
  "near",
  "will",
  "may",
  "could",
  "would",
]);

export function extractKeyTerms(text: string, limit = 6): string[] {
  const words = text
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));

  const proper: string[] = [];
  const rest: string[] = [];
  for (const w of words) {
    if (/^[A-Z]/.test(w) && w.length > 2) proper.push(w);
    else rest.push(w.toLowerCase());
  }

  const uniq = Array.from(new Set([...proper, ...rest]));
  return uniq.slice(0, limit);
}

export function tokenOverlap(a: string, b: string): number {
  const A = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3)
  );
  const B = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3)
  );
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n += 1;
  return n / Math.min(A.size, B.size);
}

export function inferTopicLabel(
  headline: string,
  category?: string | null
): string | null {
  const h = headline.toLowerCase();
  if (category && category !== "general") return category;
  if (/\b(climate|emission|wildfire|drought)\b/.test(h)) return "climate";
  if (/\b(election|vote|congress|senate|president)\b/.test(h)) return "politics";
  if (/\b(market|stock|bank|inflation|economy)\b/.test(h)) return "economy";
  if (/\b(war|ceasefire|troops|missile)\b/.test(h)) return "conflict";
  if (/\b(nasa|space|scientist|study|research)\b/.test(h)) return "science";
  if (/\b(health|hospital|vaccine|fda)\b/.test(h)) return "health";
  return null;
}
