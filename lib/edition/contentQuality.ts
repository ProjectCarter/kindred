/**
 * Content quality gates — omit weak / placeholder / mismatched material
 * rather than publishing it.
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
  /nothing you have to finish/i,
];

export function isPlaceholderCopy(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  const t = text.trim();
  if (t.length < 12) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(t));
}

/** Collapse near-duplicate paragraphs / sentences. */
export function dedupeProse(paragraphs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of paragraphs) {
    const cleaned = p.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (key.length < 8) continue;
    // Near-duplicate: same first 80 normalized chars
    const sig = key.slice(0, 80);
    if (seen.has(sig)) continue;
    // Also skip if this paragraph largely repeats a previous one
    let dup = false;
    for (const prev of seen) {
      if (prev.includes(sig) || sig.includes(prev.slice(0, 60))) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    seen.add(sig);
    out.push(cleaned);
  }
  return out;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function hasSubstance(
  text: string | null | undefined,
  minWords = 18
): boolean {
  if (!text?.trim()) return false;
  if (isPlaceholderCopy(text)) return false;
  return wordCount(text) >= minWords;
}

/** Filter discovery why-labels that are internal scoring jargon. */
export function isInternalScoreLabel(label: string): boolean {
  return (
    /editorial quality|magazine desk|matches what you tend|score|algorithm|boost|rank|weight/i.test(
      label
    ) || isPlaceholderCopy(label)
  );
}
