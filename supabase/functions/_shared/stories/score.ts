import {
  BREAKING_HINTS,
  INTEREST_MAP,
  LOW_QUALITY_SOURCE_HINTS,
  NATIONAL_HINTS,
  PRESS_RELEASE_SOURCE_HINTS,
  QUALITY_SOURCES,
  UPLIFTING_HINTS,
  WORLD_HINTS,
} from "./sources.ts";
import {
  hoursSince,
  matchesRecentCoverage,
  normalizeTitleKey,
  tokenOverlap,
} from "./diversity.ts";
import {
  UPLIFT_TONE_HINTS,
  WORLD_SCOPE_HINTS,
  isPublicSafetyStory,
  shouldDeprioritizeForTone,
} from "../editor/tone.ts";
import { isPressReleaseWire } from "../../../../lib/edition/localNewsFreshness.ts";
import type {
  CandidateStory,
  StoryRankingContext,
  StorySelectionReason,
} from "./types.ts";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function sourceQuality(source: string): { score: number; reason?: StorySelectionReason } {
  const key = normalize(source);
  for (const [name, weight] of Object.entries(QUALITY_SOURCES)) {
    if (key.includes(name)) {
      return {
        score: 18 * weight,
        reason: {
          code: "editorial_quality",
          label: `Trusted source (${source})`,
          weight: 18 * weight,
        },
      };
    }
  }
  for (const bad of LOW_QUALITY_SOURCE_HINTS) {
    if (key.includes(bad)) {
      return {
        score: -12,
        reason: {
          code: "editorial_quality_low",
          label: "Lower editorial confidence",
          weight: -12,
        },
      };
    }
  }
  return { score: 4 };
}

function interestScore(
  story: CandidateStory,
  interests: string[]
): { score: number; reasons: StorySelectionReason[] } {
  if (!interests.length) return { score: 0, reasons: [] };
  const hay = normalize(`${story.title} ${story.description} ${story.category ?? ""}`);
  const reasons: StorySelectionReason[] = [];
  let score = 0;

  interests.forEach((interest, index) => {
    const meta = INTEREST_MAP[interest];
    const weight = Math.max(6, 16 - index * 3);
    let hit = false;
    if (meta?.category && story.category === meta.category) hit = true;
    if (meta?.keywords.some((k) => hay.includes(k))) hit = true;
    if (hay.includes(normalize(interest))) hit = true;
    if (hit) {
      score += weight;
      reasons.push({
        code: "user_interest",
        label: `Matches your interest in ${interest}`,
        weight,
      });
    }
  });

  return { score, reasons };
}

function followedTopicScore(
  story: CandidateStory,
  topics: string[]
): { score: number; reasons: StorySelectionReason[] } {
  if (!topics.length) return { score: 0, reasons: [] };
  const hay = normalize(`${story.title} ${story.description}`);
  const reasons: StorySelectionReason[] = [];
  let score = 0;
  for (const topic of topics) {
    const t = normalize(topic);
    if (t && hay.includes(t)) {
      score += 14;
      reasons.push({
        code: "followed_topic",
        label: `Follows your topic “${topic}”`,
        weight: 14,
      });
    }
  }
  return { score, reasons };
}

function localScore(
  story: CandidateStory,
  ctx: StoryRankingContext
): { score: number; reasons: StorySelectionReason[] } {
  const hay = normalize(`${story.title} ${story.description}`);
  const reasons: StorySelectionReason[] = [];
  let score = 0;

  if (story.pool === "local") {
    score += 10;
    reasons.push({
      code: "local_pool",
      label: "Drawn from local/regional coverage",
      weight: 10,
    });
  }

  const placeParts = [ctx.city, ctx.region, ctx.state]
    .filter(Boolean)
    .map((p) => normalize(String(p)));

  for (const place of placeParts) {
    if (place.length >= 3 && hay.includes(place)) {
      score += 22;
      reasons.push({
        code: "local_relevance",
        label: `Locally relevant to ${place}`,
        weight: 22,
      });
      break;
    }
  }

  return { score, reasons };
}

function breakingScore(
  story: CandidateStory,
  now: Date
): { score: number; reasons: StorySelectionReason[] } {
  const reasons: StorySelectionReason[] = [];
  let score = 0;
  const text = `${story.title} ${story.description}`;
  const hours = hoursSince(story.publishedAt, now);

  if (BREAKING_HINTS.test(text)) {
    score += 16;
    reasons.push({
      code: "breaking_language",
      label: "Marked as developing / breaking",
      weight: 16,
    });
  }

  if (hours !== null && hours <= 3) {
    score += 12;
    reasons.push({
      code: "breaking_fresh",
      label: "Very recent wire copy",
      weight: 12,
    });
  } else if (hours !== null && hours <= 8) {
    score += 6;
  }

  if (NATIONAL_HINTS.test(text) && hours !== null && hours <= 12) {
    score += 8;
    reasons.push({
      code: "national_importance",
      label: "Significant national/world development",
      weight: 8,
    });
  }

  if (WORLD_HINTS.test(text) && hours !== null && hours <= 24) {
    score += 7;
    reasons.push({
      code: "global_scope",
      label: "International development for world balance",
      weight: 7,
    });
  }

  return { score, reasons };
}

/**
 * Newspaper freshness curve — this morning’s paper prefers today’s wires.
 * Soft decay through yesterday; clear penalty for stale multi-day copy.
 */
function freshnessScore(
  story: CandidateStory,
  now: Date
): { score: number; reasons: StorySelectionReason[] } {
  const hours = hoursSince(story.publishedAt, now);
  if (hours === null) {
    return {
      score: 0,
      reasons: [
        {
          code: "freshness_unknown",
          label: "Publish time unavailable",
          weight: 0,
        },
      ],
    };
  }
  if (hours <= 4) {
    return {
      score: 16,
      reasons: [{ code: "freshness", label: "Published this morning", weight: 16 }],
    };
  }
  if (hours <= 12) {
    return {
      score: 12,
      reasons: [{ code: "freshness", label: "Published in the last half day", weight: 12 }],
    };
  }
  if (hours <= 24) {
    return {
      score: 8,
      reasons: [{ code: "freshness", label: "Published in the last day", weight: 8 }],
    };
  }
  if (hours <= 36) return { score: 3, reasons: [] };
  if (hours <= 48) {
    return {
      score: -2,
      reasons: [
        {
          code: "freshness_aging",
          label: "Aging for a morning edition",
          weight: -2,
        },
      ],
    };
  }
  if (hours <= 72) {
    return {
      score: -10,
      reasons: [
        {
          code: "stale",
          label: "Older than preferred for today’s paper",
          weight: -10,
        },
      ],
    };
  }
  return {
    score: -18,
    reasons: [
      {
        code: "stale",
        label: "Too old for the morning edition",
        weight: -18,
      },
    ],
  };
}

function featureScore(story: CandidateStory): {
  score: number;
  reasons: StorySelectionReason[];
} {
  const text = `${story.title} ${story.description}`;
  if (UPLIFTING_HINTS.test(text) || story.category === "science") {
    return {
      score: 10,
      reasons: [
        {
          code: "feature_tone",
          label: "Interesting or uplifting feature tone",
          weight: 10,
        },
      ],
    };
  }
  return { score: 0, reasons: [] };
}

function clickbaitPenalty(title: string): number {
  if (/^\d+\s+things/i.test(title)) return -10;
  if (/you won't believe|shocking|gone wrong/i.test(title)) return -14;
  if ((title.match(/!/g) ?? []).length >= 2) return -8;
  if (title.length > 0 && title === title.toUpperCase()) return -10;
  return 0;
}

/**
 * Quiet personalization — boosts learned sources/topics without
 * overpowering editorial quality or front-page diversity.
 * Confidence scales how strongly behavior influences the score.
 */
function personalizationScore(
  story: CandidateStory,
  ctx: StoryRankingContext
): { score: number; reasons: StorySelectionReason[] } {
  const p = ctx.personalization;
  if (!p || p.confidence <= 0) return { score: 0, reasons: [] };

  const reasons: StorySelectionReason[] = [];
  let score = 0;
  const scale = 0.35 + p.confidence * 0.65; // 0.35–1.0
  const hay = normalize(`${story.title} ${story.description} ${story.category ?? ""}`);
  const sourceKey = normalize(story.source);

  for (const fav of p.favoriteSources.slice(0, 6)) {
    if (sourceKey.includes(fav.key) || fav.key.includes(sourceKey)) {
      const weight = Math.min(14, 5 + fav.weight) * scale;
      score += weight;
      reasons.push({
        code: "favorite_source",
        label: `From a publisher you often read (${story.source})`,
        weight,
      });
      break;
    }
  }

  for (const topic of p.followedTopics.slice(0, 8)) {
    if (topic.key.length >= 3 && hay.includes(topic.key)) {
      const weight = Math.min(12, 4 + topic.weight * 0.8) * scale;
      score += weight;
      reasons.push({
        code: "learned_topic",
        label: `Matches topics you tend to read`,
        weight,
      });
      break;
    }
  }

  for (const skipped of p.skippedTopics.slice(0, 6)) {
    if (skipped.key.length >= 3 && hay.includes(skipped.key)) {
      const weight = -Math.min(10, 3 + skipped.weight) * scale;
      score += weight;
      reasons.push({
        code: "skipped_topic",
        label: "Similar to topics you usually pass over",
        weight,
      });
      break;
    }
  }

  const titleKey = normalizeTitleKey(story.title);
  const engagedHit = p.engagedStoryKeys.some((k) => {
    const nk = normalize(k);
    return (
      (titleKey && nk && (titleKey.includes(nk.slice(0, 40)) || nk.includes(titleKey.slice(0, 40)))) ||
      tokenOverlap(story.title, k) >= 0.55
    );
  });
  if (engagedHit) {
    // Mild boost for continuing a thread the reader already opened/clipped —
    // still subject to repetition_penalty via recentStoryKeys.
    const weight = 4 * scale;
    score += weight;
    reasons.push({
      code: "prior_engagement",
      label: "Related to stories you’ve engaged with",
      weight,
    });
  }

  const clippedHit = p.clippedStoryKeys.some(
    (k) => tokenOverlap(`${story.title} ${story.category ?? ""}`, k) >= 0.45
  );
  if (clippedHit) {
    const weight = 6 * scale;
    score += weight;
    reasons.push({
      code: "clipping_affinity",
      label: "In line with sections you’ve saved",
      weight,
    });
  }

  // Soft cap so personalization never dominates wire quality + freshness.
  const cap = ctx.editorial?.policy.personalizationIntegrityCap ?? 22;
  const capped = Math.max(-12, Math.min(cap, score));
  return { score: capped, reasons };
}

/**
 * Editorial edition scoring — morning relevance, emotional balance,
 * world desk, doomscrolling resistance.
 *
 * Kindred's mission is to help people have a better day, not to farm
 * engagement with fear or outrage. Fear/violence/disaster/scandal
 * content is meaningfully deprioritized every day (not just weekends),
 * and community/discovery/nature/culture content is meaningfully
 * boosted every day. This is a soft ranking preference, not a
 * blacklist: a story that also reads as a genuine public-safety or
 * daily-life matter (evacuation, severe weather, road closure, recall)
 * is exempt from the penalty and still competes normally.
 */
function editorialEditionScore(
  story: CandidateStory,
  ctx: StoryRankingContext,
  now: Date
): { score: number; reasons: StorySelectionReason[] } {
  const reasons: StorySelectionReason[] = [];
  let score = 0;
  const text = `${story.title} ${story.description}`;
  const hours = hoursSince(story.publishedAt, now);
  const policy = ctx.editorial?.policy;
  const leisure = policy?.preferLeisureTone ?? false;
  const morningHours = policy?.morningFreshHours ?? 6;

  if (hours !== null && hours <= morningHours) {
    const weight = leisure ? 6 : 10;
    score += weight;
    reasons.push({
      code: "morning_relevance",
      label: leisure
        ? "Fresh enough for a weekend morning"
        : "Fresh for this morning’s edition",
      weight,
    });
  }

  if (shouldDeprioritizeForTone(text)) {
    const weight = leisure ? -18 : -14;
    score += weight;
    reasons.push({
      code: leisure ? "weekend_heavy_penalty" : "emotional_weight",
      label: "Fear, violence, or outrage-driven framing — not Kindred's default front page",
      weight,
    });
  } else if (isPublicSafetyStory(text)) {
    reasons.push({
      code: "public_safety",
      label: "Genuinely important for safety or daily life — kept regardless of tone",
      weight: 6,
    });
    score += 6;
  }

  if (UPLIFT_TONE_HINTS.test(text) || UPLIFTING_HINTS.test(text)) {
    const weight = leisure ? 12 : 10;
    score += weight;
    reasons.push({
      code: leisure ? "weekend_leisure" : "emotional_lift",
      label: leisure
        ? "Weekend leisure tone — room to breathe"
        : "Helps someone discover, learn, or enjoy their community",
      weight,
    });
  }

  if (
    (policy?.preferWorldBalance ?? true) &&
    (WORLD_SCOPE_HINTS.test(text) || WORLD_HINTS.test(text))
  ) {
    score += 5;
    reasons.push({
      code: "world_balance",
      label: "World desk — international balance",
      weight: 5,
    });
  }

  return { score, reasons };
}

/**
 * Soft penalty when a candidate overlaps heavily with other high-scoring
 * same-pool titles — used only as a signal; hard dedupe happens at selection.
 */
function intraPoolCrowdingPenalty(
  story: CandidateStory,
  ctx: StoryRankingContext
): { score: number; reasons: StorySelectionReason[] } {
  // Mild penalty for very generic wire titles that crowd the national pool.
  if (story.pool !== "general") return { score: 0, reasons: [] };
  const title = normalizeTitleKey(story.title);
  if (title.split(" ").length <= 4) {
    return {
      score: -2,
      reasons: [
        {
          code: "crowding_soft",
          label: "Thin headline — prefer fuller reportage",
          weight: -2,
        },
      ],
    };
  }
  void ctx;
  return { score: 0, reasons: [] };
}

export type ScoredCandidate = {
  story: CandidateStory;
  score: number;
  reasons: StorySelectionReason[];
};

export function scoreCandidate(
  story: CandidateStory,
  ctx: StoryRankingContext
): ScoredCandidate {
  const now = ctx.now ?? new Date();
  const reasons: StorySelectionReason[] = [];
  let score = 0;

  const quality = sourceQuality(story.source);
  score += quality.score;
  if (quality.reason) reasons.push(quality.reason);

  if (
    isPressReleaseWire({ source: story.source, url: story.url }) ||
    PRESS_RELEASE_SOURCE_HINTS.some((h) =>
      normalize(story.source).includes(h)
    )
  ) {
    score -= 20;
    reasons.push({
      code: "press_release_penalty",
      label: "Syndicated press release — prefer original local reporting",
      weight: -20,
    });
  }

  const interest = interestScore(story, ctx.interests);
  score += interest.score;
  reasons.push(...interest.reasons);

  const followed = followedTopicScore(story, ctx.followedTopics);
  score += followed.score;
  reasons.push(...followed.reasons);

  const local = localScore(story, ctx);
  score += local.score;
  reasons.push(...local.reasons);

  const breaking = breakingScore(story, now);
  score += breaking.score;
  reasons.push(...breaking.reasons);

  const fresh = freshnessScore(story, now);
  score += fresh.score;
  reasons.push(...fresh.reasons);

  const feature = featureScore(story);
  score += feature.score;
  reasons.push(...feature.reasons);

  const bait = clickbaitPenalty(story.title);
  if (bait) {
    score += bait;
    reasons.push({
      code: "clickbait_penalty",
      label: "Penalized for sensational framing",
      weight: bait,
    });
  }

  const personal = personalizationScore(story, ctx);
  score += personal.score;
  reasons.push(...personal.reasons);

  const edition = editorialEditionScore(story, ctx, now);
  score += edition.score;
  reasons.push(...edition.reasons);

  const crowding = intraPoolCrowdingPenalty(story, ctx);
  score += crowding.score;
  reasons.push(...crowding.reasons);

  const recentKeys = ctx.recentStoryKeys ?? [];
  if (matchesRecentCoverage(story, recentKeys)) {
    score -= 32;
    reasons.push({
      code: "repetition_penalty",
      label: "Recently covered — held back for a fresher page",
      weight: -32,
    });
  } else if (recentKeys.length) {
    // Mild soft penalty for partial title echoes of recent coverage.
    const titleKey = normalizeTitleKey(story.title);
    const softHit = recentKeys.some(
      (r) => titleKey && tokenOverlap(titleKey, normalizeTitleKey(r)) >= 0.5
    );
    if (softHit) {
      score -= 12;
      reasons.push({
        code: "repetition_soft",
        label: "Echoes a recent edition — deprioritized",
        weight: -12,
      });
    }
  }

  return { story, score, reasons: reasons.sort((a, b) => b.weight - a.weight) };
}

/** Token overlap for diversity — higher means more similar. */
export function storySimilarity(a: CandidateStory, b: CandidateStory): number {
  return tokenOverlap(
    `${a.title} ${a.description}`,
    `${b.title} ${b.description}`
  );
}
