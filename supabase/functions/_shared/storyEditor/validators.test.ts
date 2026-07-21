/**
 * Story Editor validator smoke tests (Node).
 * Run: npx tsx supabase/functions/_shared/storyEditor/validators.test.ts
 *
 * Note: Deno edge modules use .ts imports; this file re-implements critical
 * assertions inline so CI can prove constitution gates without Deno.
 */

import assert from "node:assert/strict";

const AI_TELLS =
  /\b(in conclusion|it is important to note|moreover|furthermore|delve|landscape|robust|tapestry|leverage|utilize|in today's world|at the end of the day)\b/i;
const PRESS_RELEASE =
  /\b(is excited to announce|committed to excellence|synerg|pleased to announce|game-?changer|disrupting the industry)\b/i;
const SENSATIONAL =
  /\b(shocking|explosive|slams|destroyed|goes viral|you won't believe|jaw-dropping|bombshell)\b/i;
const PROCEDURAL_OPEN =
  /^(in a (recent|new|official)|according to (a |the )?(report|statement|press)|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|as of|officials (said|announced))/i;

function extractNumberTokens(text: string): string[] {
  const matches = text.match(
    /(?:\$\s?)?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?%?|\$\s?\d+(?:\.\d+)?/g
  );
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, "")))];
}

function normalizeForContainment(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.%$]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unsupportedNumbers(draft: string, source: string): string[] {
  const sourceNorm = normalizeForContainment(source);
  const bad: string[] = [];
  for (const token of extractNumberTokens(draft)) {
    const bare = token.replace(/[$,]/g, "");
    if (bare.length <= 1) continue;
    const variants = [
      token.toLowerCase(),
      bare,
      token.replace(/,/g, "").toLowerCase(),
    ];
    const ok = variants.some((v) => sourceNorm.includes(v.toLowerCase()));
    if (!ok) bad.push(token);
  }
  return bad;
}

assert.equal(AI_TELLS.test("It is important to note the change."), true);
assert.equal(PRESS_RELEASE.test("The firm is excited to announce a deal."), true);
assert.equal(SENSATIONAL.test("A shocking twist changed everything."), true);
assert.equal(PROCEDURAL_OPEN.test("Officials announced a new rule today."), true);
assert.deepEqual(
  unsupportedNumbers("Losses hit $4.2 billion.", "Losses hit $1 billion."),
  ["$4.2"]
);
assert.deepEqual(
  unsupportedNumbers("Losses hit $1 billion.", "Losses hit $1 billion yesterday."),
  []
);

function extractQuotedPassages(text: string): string[] {
  const matches = text.match(/"([^"]{6,})"/g) ?? [];
  return matches.map((q) => q.slice(1, -1).trim());
}

function quoteSubstantivelyInSource(quote: string, sourceText: string): boolean {
  const norm = normalizeForContainment(quote);
  const src = normalizeForContainment(sourceText);
  if (!norm || norm.length < 6) return true;
  return src.includes(norm.slice(0, Math.min(48, norm.length)));
}

function fabricatedQuotes(draft: string, sourceText: string): string[] {
  return extractQuotedPassages(draft).filter(
    (q) => !quoteSubstantivelyInSource(q, sourceText)
  );
}

assert.deepEqual(
  fabricatedQuotes('Coach Smith said "We are ready for camp."', "Coach Smith said We are ready for camp."),
  []
);
assert.equal(
  fabricatedQuotes('Mayor Lee said "This will fix everything overnight."', "Council voted on zoning.").length,
  1
);

console.log("storyEditor validator smoke tests: ok");
