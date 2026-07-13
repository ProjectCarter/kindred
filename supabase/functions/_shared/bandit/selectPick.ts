import { matchesRecentCoverage } from "../stories/diversity.ts";
import type { ScoredCandidate } from "../stories/score.ts";
import type { CandidateStory } from "../stories/types.ts";
import {
  HEAVY_TONE_HINTS,
  UPLIFT_TONE_HINTS,
} from "../editor/tone.ts";

export type BanditsPickStory = {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  category: string | null;
  /** Quiet editorial reason — for dek / grounding, not a score label. */
  why: string;
};

function cleanHeadline(title: string): string {
  return title.replace(/\s+[—–|-]\s+[^—–|-]+$/, "").trim();
}

function conciseSummary(description: string, title: string): string {
  const raw = (description || title).replace(/\s+/g, " ").trim();
  if (raw.length <= 220) return raw;
  const sliced = raw.slice(0, 217);
  const lastStop = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("; "),
    sliced.lastIndexOf(", ")
  );
  if (lastStop > 120) return sliced.slice(0, lastStop + 1).trim();
  return `${sliced.trim()}…`;
}

function interestOverlap(
  story: CandidateStory,
  interests: string[]
): number {
  if (!interests.length) return 0;
  const hay = `${story.title} ${story.description} ${story.category ?? ""}`.toLowerCase();
  let hits = 0;
  for (const interest of interests) {
    const token = interest.trim().toLowerCase();
    if (token.length >= 3 && hay.includes(token)) hits += 1;
  }
  return hits;
}

/**
 * Bandit recommends like a trusted friend, not a wire desk. This
 * reuses Kindred's shared editorial-tone bank (`editor/tone.ts`) for
 * fear/violence/outrage/scandal, plus a technical/regulatory pattern
 * specific to this slot — dry industry copy that isn't "heavy" but
 * still doesn't belong in a warm closing note.
 */
const TECHNICAL_PATTERN =
  /\b(?:regulators?|regulatory|impurit(?:y|ies)|compliance|quarterly earnings|shareholders?|litigation|settlement|merger|acquisition|antitrust|layoffs?|bankrupt(?:cy)?|sec filing|ipo|interest rates?|federal reserve|tariffs?|earnings call|stock (?:price|market)|shares (?:fell|rose|slipped|jumped|plunged)|data breach|supply chain|inflation|gdp|unemployment rate|press release|proxy fight|board of directors|quarterly (?:report|results)|filing with|patent dispute|product recall)\b/;

const DELIGHT_PATTERN =
  /\b(hidden|secret|mystery|mysterious|centuries-old|ancient|folklore|tradition|handmade|artisan|first time|rare|unusual|little-known|forgotten|quirky|surprising|remarkable|astonishing|breathtaking)\b/;

function editorialCharacter(story: CandidateStory): {
  technical: boolean;
  heavy: boolean;
  delightful: boolean;
} {
  const hay = `${story.title} ${story.description}`.toLowerCase();
  return {
    technical: TECHNICAL_PATTERN.test(hay),
    heavy: HEAVY_TONE_HINTS.test(hay),
    delightful: DELIGHT_PATTERN.test(hay) || UPLIFT_TONE_HINTS.test(hay),
  };
}

function broadenScore(
  c: ScoredCandidate,
  interests: string[],
  frontPageIds: Set<string>,
  recentKeys: string[]
): number {
  let score = c.score * 0.35;

  // Prefer stories that stretch beyond the reader's usual map.
  const overlap = interestOverlap(c.story, interests);
  if (overlap === 0) score += 18;
  else if (overlap === 1) score += 4;
  else score -= 12;

  if (c.reasons.some((r) => r.code === "user_interest")) score -= 16;
  if (c.reasons.some((r) => r.code === "feature_tone")) score += 14;
  if (c.reasons.some((r) => r.code === "weekend_leisure")) score += 6;

  const category = (c.story.category || "").toLowerCase();
  const character = editorialCharacter(c.story);

  // Bandit's Pick is a warm, curious recommendation — not the trade press
  // and not the day's hardest news. Culture, arts, and travel read best
  // in this slot by default; science and health only earn the same trust
  // once they clear the technical/regulatory filter below.
  if (["culture", "arts", "travel"].includes(category)) score += 12;
  if (["science", "health"].includes(category) && !character.technical) {
    score += 8;
  }

  if (character.delightful) score += 16;
  if (character.technical) score -= 30;
  if (character.heavy) score -= 26;

  if (c.story.pool === "secondary") score += 8;
  if (c.story.pool === "general" && overlap === 0) score += 6;

  // Surprise: prefer something not already on the front page.
  if (!frontPageIds.has(c.story.id)) score += 10;
  else score -= 8;

  if (recentKeys.length && matchesRecentCoverage(c.story, recentKeys)) {
    score -= 40;
  }

  return score;
}

function whyLine(c: ScoredCandidate, interests: string[]): string {
  if (editorialCharacter(c.story).delightful) {
    return "The kind of story worth telling someone about later.";
  }
  if (interestOverlap(c.story, interests) === 0) {
    return "A little outside your usual path — chosen to broaden the morning.";
  }
  if (c.reasons.some((r) => r.code === "feature_tone")) {
    return "A quieter piece for curiosity, not the day’s hard news.";
  }
  return "One careful recommendation from the desk.";
}

/**
 * Bandit's Pick — exactly one story.
 * Not engagement optimization: prefer surprise and a wider lens than the Lead.
 */
export function selectBanditsPick(input: {
  scored: ScoredCandidate[];
  leadId?: string | null;
  frontPageIds?: string[];
  interests?: string[];
  recentKeys?: string[];
}): BanditsPickStory | null {
  const leadId = input.leadId ?? null;
  const frontPageIds = new Set(input.frontPageIds ?? []);
  const interests = input.interests ?? [];
  const recentKeys = input.recentKeys ?? [];

  const pool = input.scored.filter((c) => {
    if (!c.story.id || !c.story.title?.trim()) return false;
    if (leadId && c.story.id === leadId) return false;
    return true;
  });

  if (!pool.length) return null;

  const ranked = [...pool].sort(
    (a, b) =>
      broadenScore(b, interests, frontPageIds, recentKeys) -
      broadenScore(a, interests, frontPageIds, recentKeys)
  );

  const pick =
    ranked.find(
      (c) =>
        !recentKeys.length || !matchesRecentCoverage(c.story, recentKeys)
    ) ?? ranked[0];

  if (!pick) return null;

  return {
    id: pick.story.id,
    headline: cleanHeadline(pick.story.title),
    summary: conciseSummary(pick.story.description, pick.story.title),
    source: pick.story.source,
    url: pick.story.url,
    publishedAt: pick.story.publishedAt,
    imageUrl: pick.story.imageUrl?.trim() || null,
    category: pick.story.category,
    why: whyLine(pick, interests),
  };
}

/** Warm Bandit intro — one or two short sentences, never a pitch deck. */
export function composeBanditsPickIntro(
  pick: BanditsPickStory,
  firstName?: string | null,
  editionDate?: string | null
): string {
  const name = firstName?.trim().split(/\s+/)[0];
  const prefix = name ? `${name}, ` : "";
  const seed = `${editionDate ?? ""}:${pick.id}`;
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i) * (i + 1)) % 3;

  const lines = [
    `${prefix}I held one more story for the end — a little outside your usual reading.`,
    `${prefix}Before you put the paper down, one quiet pick from me.`,
    `${prefix}One careful recommendation to close the morning — chosen for curiosity.`,
  ];
  return lines[n].replace(/!+/g, ".").trim();
}
