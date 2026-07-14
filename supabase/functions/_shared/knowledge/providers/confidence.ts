/** Title overlap and disambiguation guards for Wikipedia entity matching. */

export const MIN_KNOWLEDGE_CONFIDENCE = 0.62;

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeTitle(value)
      .split(" ")
      .filter((t) => t.length >= 2)
  );
}

export function titleMatchScore(query: string, pageTitle: string): number {
  const q = normalizeTitle(query);
  const p = normalizeTitle(pageTitle);
  if (!q || !p) return 0;
  if (q === p) return 1;
  if (p.startsWith(q) || q.startsWith(p)) return 0.9;

  const qTokens = tokenSet(query);
  const pTokens = tokenSet(pageTitle);
  if (qTokens.size === 0 || pTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of qTokens) {
    if (pTokens.has(token)) overlap += 1;
  }
  const recall = overlap / qTokens.size;
  const precision = overlap / pTokens.size;
  return Math.min(0.88, (recall * 0.65 + precision * 0.35));
}

export function isDisambiguationPage(title: string, extract: string): boolean {
  if (/\(disambiguation\)/i.test(title)) return true;
  const trimmed = extract.trim();
  return /^may refer to:/i.test(trimmed) || /^"[^"]+" may refer to:/i.test(trimmed);
}

export function isUnrelatedTopic(title: string, extract: string, query: string): boolean {
  const score = titleMatchScore(query, title);
  if (score >= 0.55) return false;
  const blob = `${title} ${extract}`.toLowerCase();
  const qTokens = [...tokenSet(query)].filter((t) => t.length >= 4);
  if (qTokens.length === 0) return true;
  const hits = qTokens.filter((t) => blob.includes(t)).length;
  return hits / qTokens.length < 0.34;
}
