/**
 * Content quality gates — omit weak / placeholder / mismatched material
 * rather than publishing it.
 */

import { containsEngineLanguage } from "./editorialVoice";

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

/** Normalize prose for duplicate comparison. */
export function normalizeProseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isNearDuplicateProse(a: string, b: string): boolean {
  const left = normalizeProseKey(a);
  const right = normalizeProseKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length < 24) {
    return longer.includes(shorter);
  }
  const sigA = shorter.slice(0, Math.min(80, shorter.length));
  const sigB = longer.slice(0, Math.min(80, longer.length));
  return (
    longer.includes(sigA) ||
    shorter.includes(sigB) ||
    sigA === sigB
  );
}

/** Collapse near-duplicate paragraphs / sentences. */
export function dedupeProse(paragraphs: string[]): string[] {
  const out: string[] = [];
  const seen: string[] = [];
  for (const p of paragraphs) {
    const cleaned = p.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = normalizeProseKey(cleaned);
    if (key.length < 8) continue;
    let dup = false;
    for (const prev of seen) {
      if (isNearDuplicateProse(cleaned, prev)) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    seen.push(cleaned);
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
    containsEngineLanguage(label) ||
    /editorial quality|magazine desk|matches what you tend|score|algorithm|boost|rank|weight|held back|trusted source|fits what you/i.test(
      label
    ) ||
    isPlaceholderCopy(label)
  );
}
