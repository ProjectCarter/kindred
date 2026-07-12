import { matchesRecentCoverage } from "../stories/diversity.ts";
import type { ScoredCandidate } from "../stories/score.ts";
import type { CandidateStory } from "../stories/types.ts";

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
  if (["science", "health", "culture", "arts", "travel"].includes(category)) {
    score += 12;
  }
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
