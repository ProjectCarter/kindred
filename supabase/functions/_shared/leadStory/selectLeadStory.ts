import { storySimilarity } from "../stories/score.ts";
import { hoursSince, isNearDuplicate } from "../stories/diversity.ts";
import type { StorySelectionReason } from "../stories/types.ts";
import type {
  LeadStory,
  LeadStoryRole,
  LeadStoryPolicy,
  SelectLeadStoryInput,
} from "./types.ts";
import { isUpliftingStory } from "../editor/tone.ts";

const DEFAULT_LOCAL_THRESHOLD = 22;
const DIVERSITY_LIMIT = 0.38;

type StoryLike = SelectLeadStoryInput["scoredCandidates"][number]["story"];
type ScoredLike = SelectLeadStoryInput["scoredCandidates"][number];

function cleanHeadline(title: string): string {
  // NewsAPI often appends " - Source Name"
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

function hasLocalSignal(c: ScoredLike): boolean {
  if (c.story.pool === "local") return true;
  return c.reasons.some(
    (r) => r.code === "local_relevance" || r.code === "local_pool"
  );
}

function hasNationalOrWorldSignal(c: ScoredLike): boolean {
  if (c.story.pool === "general") return true;
  return c.reasons.some(
    (r) =>
      r.code === "national_importance" ||
      r.code === "breaking_language" ||
      r.code === "breaking_fresh"
  );
}

function hasBreakingSignal(c: ScoredLike): boolean {
  return c.reasons.some(
    (r) =>
      r.code === "breaking_language" ||
      r.code === "breaking_fresh" ||
      r.code === "national_importance"
  );
}

function toLeadRole(
  c: ScoredLike,
  preferred: LeadStoryRole | null
): LeadStoryRole {
  if (preferred) return preferred;
  if (hasBreakingSignal(c) && c.score >= 30) return "breaking";
  if (hasLocalSignal(c)) return "local";
  if (hasNationalOrWorldSignal(c)) return "national";
  return "world";
}

function isDistinctFromBelow(
  candidate: StoryLike,
  below: StoryLike[],
  allowId: string | null
): boolean {
  return below.every((b) => {
    if (allowId && b.id === allowId) return true;
    if (b.id === candidate.id) return true; // same story elevated — ok
    const left = {
      id: candidate.id,
      title: candidate.title,
      description: candidate.description,
      source: candidate.source,
      url: candidate.url,
      publishedAt: candidate.publishedAt,
      category: null,
      pool: "general" as const,
    };
    const right = {
      id: b.id,
      title: b.title,
      description: b.description,
      source: b.source,
      url: b.url,
      publishedAt: b.publishedAt,
      category: null,
      pool: "general" as const,
    };
    if (isNearDuplicate(left, right)) return false;
    return storySimilarity(left, right) < DIVERSITY_LIMIT;
  });
}

/** Prefer fresher wire when scores are within a newspaper-editor margin. */
function preferFresher(a: ScoredLike, b: ScoredLike, now: Date): number {
  if (Math.abs(a.score - b.score) > 4) return b.score - a.score;
  const ha = hoursSince(a.story.publishedAt, now);
  const hb = hoursSince(b.story.publishedAt, now);
  if (ha === null && hb === null) return b.score - a.score;
  if (ha === null) return 1;
  if (hb === null) return -1;
  if (ha !== hb) return ha - hb;
  return b.score - a.score;
}

function buildLeadStory(
  c: ScoredLike,
  role: LeadStoryRole,
  strategy: LeadStory["selection"]["strategy"],
  belowFoldTitles: string[],
  extraReasons: StorySelectionReason[]
): LeadStory {
  const imageUri = c.story.imageUrl?.trim() || null;
  return {
    id: c.story.id,
    headline: cleanHeadline(c.story.title),
    summary: conciseSummary(c.story.description, c.story.title),
    source: c.story.source,
    url: c.story.url,
    publishedAt: c.story.publishedAt,
    role,
    heroImage: {
      uri: imageUri,
      alt: cleanHeadline(c.story.title),
      source: imageUri ? "article" : "none",
    },
    banditsPick: {
      reserved: true,
      isBanditsPick: false,
    },
    selection: {
      score: c.score,
      reasons: [
        ...extraReasons,
        ...c.reasons.slice(0, 5),
      ],
      belowFoldTitles,
      strategy,
    },
  };
}

/**
 * Select one Front Page Lead Story using editorial judgment.
 * Prefer important local; otherwise strongest national/world;
 * weekend editions may elevate a strong feature.
 */
export function selectLeadStory(
  input: SelectLeadStoryInput,
  policy: LeadStoryPolicy = {}
): LeadStory | null {
  const threshold = input.localScoreThreshold ?? DEFAULT_LOCAL_THRESHOLD;
  const below = input.topStories.map((s) => s.story);
  const belowFoldTitles = below.map((s) => s.title);
  const belowIds = new Set(below.map((s) => s.id));

  const pool: ScoredLike[] = [
    ...input.scoredCandidates,
    ...input.topStories.map((s) => ({
      story: s.story,
      score: s.score,
      reasons: s.reasons,
    })),
  ];

  const byId = new Map<string, ScoredLike>();
  for (const c of pool) {
    const prev = byId.get(c.story.id);
    if (!prev || c.score > prev.score) byId.set(c.story.id, c);
  }
  const candidates = Array.from(byId.values()).sort((a, b) =>
    preferFresher(a, b, new Date())
  );

  if (!candidates.length) return null;

  const reason = (
    code: string,
    label: string,
    weight: number
  ): StorySelectionReason => ({ code, label, weight });

  // 1) Prefer important local
  const localPick = candidates.find(
    (c) =>
      hasLocalSignal(c) &&
      c.score >= threshold &&
      isDistinctFromBelow(
        c.story,
        below.filter((b) => b.id !== c.story.id),
        c.story.id
      )
  );
  if (localPick) {
    return buildLeadStory(
      localPick,
      "local",
      "prefer_local",
      belowFoldTitles.filter((t) => t !== localPick.story.title),
      [
        reason(
          "lead_prefer_local",
          "Selected as Front Page Lead for local importance",
          25
        ),
      ]
    );
  }

  // 2) Breaking — only when clearly strong
  const breakingFromSlate = input.topStories.find((s) => s.role === "breaking");
  if (breakingFromSlate && breakingFromSlate.score >= 30) {
    const c =
      byId.get(breakingFromSlate.story.id) ??
      ({
        story: breakingFromSlate.story,
        score: breakingFromSlate.score,
        reasons: breakingFromSlate.reasons,
      } as ScoredLike);
    return buildLeadStory(
      c,
      "breaking",
      "breaking",
      belowFoldTitles.filter((t) => t !== c.story.title),
      [
        reason(
          "lead_breaking",
          "Selected as Front Page Lead for breaking importance",
          24
        ),
      ]
    );
  }

  // 3) Weekend — strong feature may lead if it outranks thin national copy
  if (policy.preferWeekendFeature) {
    const featureLead = candidates.find(
      (c) =>
        (isUpliftingStory(`${c.story.title} ${c.story.description}`) ||
          c.reasons.some(
            (r) => r.code === "feature_tone" || r.code === "weekend_leisure"
          )) &&
        c.score >= 28 &&
        isDistinctFromBelow(
          c.story,
          below.filter((b) => b.id !== c.story.id),
          belowIds.has(c.story.id) ? c.story.id : null
        )
    );
    if (featureLead) {
      return buildLeadStory(
        featureLead,
        "national",
        "national_world",
        belowFoldTitles.filter((t) => t !== featureLead.story.title),
        [
          reason(
            "lead_weekend_feature",
            "Weekend Lead — a curious feature worthy of the cover",
            23
          ),
        ]
      );
    }
  }

  // 4) Strongest national / world — prefer slate national, else best general
  const nationalFromSlate = input.topStories.find(
    (s) => s.role === "national" || s.role === "breaking"
  );
  if (nationalFromSlate) {
    const c =
      byId.get(nationalFromSlate.story.id) ??
      ({
        story: nationalFromSlate.story,
        score: nationalFromSlate.score,
        reasons: nationalFromSlate.reasons,
      } as ScoredLike);
    return buildLeadStory(
      c,
      nationalFromSlate.role === "breaking" ? "breaking" : "national",
      "national_world",
      belowFoldTitles.filter((t) => t !== c.story.title),
      [
        reason(
          "lead_national",
          "Selected as Front Page Lead — strongest national/world story",
          22
        ),
      ]
    );
  }

  const nationalPool = candidates.find(
    (c) =>
      hasNationalOrWorldSignal(c) &&
      isDistinctFromBelow(
        c.story,
        below.filter((b) => b.id !== c.story.id),
        belowIds.has(c.story.id) ? c.story.id : null
      )
  );
  if (nationalPool) {
    return buildLeadStory(
      nationalPool,
      toLeadRole(nationalPool, "national"),
      "national_world",
      belowFoldTitles.filter((t) => t !== nationalPool.story.title),
      [
        reason(
          "lead_national_pool",
          "Selected as Front Page Lead from national coverage",
          20
        ),
      ]
    );
  }

  // 5) Fallback
  const fallback = candidates.find((c) =>
    isDistinctFromBelow(
      c.story,
      below.filter((b) => b.id !== c.story.id),
      belowIds.has(c.story.id) ? c.story.id : null
    )
  );
  if (!fallback) return null;

  return buildLeadStory(
    fallback,
    toLeadRole(fallback, null),
    "fallback",
    belowFoldTitles.filter((t) => t !== fallback.story.title),
    [
      reason(
        "lead_fallback",
        "Selected as Front Page Lead — best available editorial story",
        10
      ),
    ]
  );
}
