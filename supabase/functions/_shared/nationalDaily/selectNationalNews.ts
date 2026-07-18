/**
 * Select 3–5 nationally consequential stories for the shared U.S. daily package.
 */

import { fetchNationalStoryCandidates } from "../stories/fetchNationalCandidates.ts";
import { scoreCandidate, storySimilarity, type ScoredCandidate } from "../stories/score.ts";
import {
  isNearDuplicate,
  matchesRecentCoverage,
  normalizeSourceKey,
} from "../stories/diversity.ts";
import { NATIONAL_HINTS } from "../stories/sources.ts";
import { isPublicSafetyStory, shouldDeprioritizeForTone } from "../editor/tone.ts";
import { policyForEditionDate } from "../editor/policy.ts";
import type { StoryRankingContext, StoryRole } from "../stories/types.ts";
import type { NationalNewsStoryPayload } from "./types.ts";

const MIN_STORIES = 3;
const MAX_STORIES = 5;
const SIMILARITY_LIMIT = 0.38;

function isEligibleNationalCandidate(c: ScoredCandidate): boolean {
  if (c.story.pool === "local") return false;

  const text = `${c.story.title} ${c.story.description}`;
  if (shouldDeprioritizeForTone(text) && !isPublicSafetyStory(text)) {
    return false;
  }

  const hasLocalOnly =
    c.reasons.some(
      (r) => r.code === "local_relevance" || r.code === "local_pool"
    ) &&
    !c.reasons.some(
      (r) =>
        r.code === "national_importance" ||
        r.code === "global_scope" ||
        r.code === "breaking_language"
    ) &&
    !NATIONAL_HINTS.test(text);

  if (hasLocalOnly) return false;

  return (
    c.story.pool === "general" ||
    c.reasons.some(
      (r) =>
        r.code === "national_importance" ||
        r.code === "global_scope" ||
        r.code === "breaking_language" ||
        r.code === "breaking_fresh" ||
        r.code === "editorial_quality"
    )
  );
}

function inferRole(c: ScoredCandidate): StoryRole {
  if (c.reasons.some((r) => r.code === "breaking_language" || r.code === "breaking_fresh")) {
    return "breaking";
  }
  if (NATIONAL_HINTS.test(`${c.story.title} ${c.story.description}`)) {
    return "national";
  }
  return "national";
}

function isDistinct(candidate: ScoredCandidate, selected: ScoredCandidate[]): boolean {
  return selected.every((s) => {
    if (isNearDuplicate(candidate.story, s.story)) return false;
    return storySimilarity(candidate.story, s.story) < SIMILARITY_LIMIT;
  });
}

function cleanHeadline(title: string): string {
  return title.replace(/\s+[—–|-]\s+[^—–|-]+$/, "").trim();
}

function conciseSummary(description: string, title: string): string {
  const raw = (description || title).replace(/\s+/g, " ").trim();
  if (raw.length <= 240) return raw;
  return `${raw.slice(0, 237).trim()}…`;
}

export type SelectNationalNewsInput = {
  editionDate: string;
  newsApiKey: string;
  now?: Date;
};

export type SelectNationalNewsResult = {
  candidates: ScoredCandidate[];
  selected: ScoredCandidate[];
};

export async function selectNationalNewsStories(
  input: SelectNationalNewsInput
): Promise<SelectNationalNewsResult> {
  const now = input.now ?? new Date();
  const { policy } = policyForEditionDate(input.editionDate, now, MAX_STORIES);

  const ranking: StoryRankingContext = {
    city: null,
    region: null,
    state: null,
    interests: [],
    followedTopics: [],
    now,
    maxStories: MAX_STORIES,
    recentStoryKeys: [],
    editorial: {
      calendar: policyForEditionDate(input.editionDate, now, MAX_STORIES).calendar,
      policy,
    },
  };

  const candidates = await fetchNationalStoryCandidates(input.newsApiKey);
  const scored = candidates
    .map((story) => scoreCandidate(story, ranking))
    .filter(isEligibleNationalCandidate)
    .sort((a, b) => b.score - a.score);

  const selected: ScoredCandidate[] = [];
  const usedSources = new Set<string>();

  for (const c of scored) {
    if (selected.length >= MAX_STORIES) break;
    if (!isDistinct(c, selected)) continue;
    if (matchesRecentCoverage(c.story, [])) continue;

    const src = normalizeSourceKey(c.story.source);
    if (src && usedSources.has(src) && selected.length >= MIN_STORIES) continue;

    selected.push(c);
    if (src) usedSources.add(src);
  }

  return { candidates: scored, selected };
}

export function buildNationalNewsStoryPayload(
  c: ScoredCandidate,
  rank: number
): NationalNewsStoryPayload {
  const imageUrl = c.story.imageUrl?.trim() || null;
  return {
    id: c.story.id,
    rank,
    headline: cleanHeadline(c.story.title),
    summary: conciseSummary(c.story.description, c.story.title),
    sourceName: c.story.source,
    sourceUrl: c.story.url,
    publishedAt: c.story.publishedAt,
    category: c.story.category ?? String(inferRole(c)),
    image: imageUrl
      ? {
          url: imageUrl,
          attribution: c.story.source,
          licenseNote: "Wire photo via NewsAPI source",
        }
      : null,
    verification: {
      editorialScore: c.score,
      reasons: c.reasons.map((r) => r.label).slice(0, 6),
      pool: c.story.pool,
    },
  };
}
