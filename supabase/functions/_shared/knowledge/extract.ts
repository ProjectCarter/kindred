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

const ORG_HINT =
  /\b(Inc|Corp|Ltd|LLC|Company|Bank|Agency|Department|Ministry|Commission|Council|University|Association|Federation|Union|Party|Fund|Authority)\b/;
const LAW_HINT =
  /\b(Act|Bill|Law|Treaty|Accord|Amendment|Regulation|Directive|Statute)\b/;
const PLACE_HINT =
  /\b(City|County|Province|State|Island|River|Sea|Ocean|Mount|Mountain|Valley|Harbor|Harbour|District)\b/;

export type NamedEntityKind =
  | "person"
  | "company"
  | "place"
  | "law"
  | "event"
  | "organization"
  | "term";

export type NamedEntity = {
  name: string;
  kind: NamedEntityKind;
};

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

/**
 * Multi-word proper nouns for Knowledge Cards — people, places, orgs, laws.
 * Prefer phrases the reader might otherwise look up outside the paper.
 */
export function extractNamedEntities(
  text: string,
  limit = 4
): NamedEntity[] {
  const cleaned = text.replace(/[“”"']/g, " ").replace(/\s+/g, " ").trim();
  const matches =
    cleaned.match(
      /\b([A-Z][a-zA-Z0-9'’.-]*(?:\s+[A-Z][a-zA-Z0-9'’.-]*){0,4})\b/g
    ) ?? [];

  const out: NamedEntity[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    const name = raw.trim();
    if (name.length < 3) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    if (STOP.has(key)) continue;
    if (
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(name)
    ) {
      continue;
    }
    seen.add(key);
    out.push({ name, kind: classifyEntity(name) });
    if (out.length >= limit) break;
  }

  return out;
}

function classifyEntity(name: string): NamedEntityKind {
  if (LAW_HINT.test(name)) return "law";
  if (ORG_HINT.test(name)) {
    if (/\b(Inc|Corp|Ltd|LLC|Company|Bank)\b/.test(name)) return "company";
    return "organization";
  }
  if (PLACE_HINT.test(name)) return "place";
  const parts = name.split(/\s+/);
  if (parts.length >= 2 && parts.every((p) => /^[A-Z]/.test(p))) {
    return "person";
  }
  if (parts.length === 1 && /^[A-Z]/.test(name)) return "term";
  return "term";
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
