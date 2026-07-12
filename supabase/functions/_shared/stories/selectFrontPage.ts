import { storySimilarity, type ScoredCandidate } from "./score.ts";
import {
  auditComposition,
  hoursSince,
  isNearDuplicate,
  matchesRecentCoverage,
  normalizeSourceKey,
} from "./diversity.ts";
import type {
  FrontPageSelection,
  RankedStory,
  StoryRankingContext,
  StoryRole,
} from "./types.ts";

/** Topic similarity gate — tighter than before for a cleaner page. */
const SIMILARITY_LIMIT = 0.38;
/** Soft freshness preference for a morning paper (hours). */
const FRESHNESS_SOFT_HOURS = 36;
/** Hard freshness ceiling unless the pool is exhausted (hours). */
const FRESHNESS_HARD_HOURS = 84;

type PickOptions = {
  /** Prefer stories not from these normalized sources. */
  avoidSources?: Set<string>;
  /** Prefer stories not in these categories. */
  avoidCategories?: Set<string>;
  /** Prefer fresher than soft hours. */
  preferFresh?: boolean;
  /** Enforce hard freshness floor. */
  requireFresh?: boolean;
  /** When true, allow a second story from an avoided source. */
  allowSourceRepeat?: boolean;
  /** When true, allow stories that already led or filled Top Stories recently. */
  allowRecentCoverage?: boolean;
};

function categoryKey(c: ScoredCandidate): string {
  return (c.story.category || c.story.pool || "general").toLowerCase();
}

function isDistinct(
  candidate: ScoredCandidate,
  selected: RankedStory[]
): boolean {
  return selected.every((s) => {
    if (isNearDuplicate(candidate.story, s.story)) return false;
    return storySimilarity(candidate.story, s.story) < SIMILARITY_LIMIT;
  });
}

function freshnessOk(
  c: ScoredCandidate,
  now: Date,
  soft: boolean,
  hard: boolean
): boolean {
  const hours = hoursSince(c.story.publishedAt, now);
  if (hours === null) return !hard;
  if (hard && hours > FRESHNESS_HARD_HOURS) return false;
  if (soft && hours > FRESHNESS_SOFT_HOURS) return false;
  return true;
}

/**
 * Editorially ranked pick — applies source/topic/freshness preferences,
 * then gradually relaxes constraints so the page still fills.
 * Recently covered stories stay off the page until every fresher option is gone.
 */
function pickBest(
  pool: ScoredCandidate[],
  selected: RankedStory[],
  predicate: (c: ScoredCandidate) => boolean,
  now: Date,
  options: PickOptions = {},
  recentStoryKeys: string[] = []
): ScoredCandidate | null {
  const base = pool
    .filter((c) => predicate(c))
    .filter((c) => isDistinct(c, selected));

  if (!base.length) return null;

  const attempts: PickOptions[] = [
    {
      ...options,
      preferFresh: options.preferFresh !== false,
      requireFresh: true,
      allowSourceRepeat: false,
      allowRecentCoverage: false,
    },
    {
      ...options,
      preferFresh: true,
      requireFresh: false,
      allowSourceRepeat: false,
      allowRecentCoverage: false,
    },
    {
      ...options,
      preferFresh: false,
      requireFresh: false,
      allowSourceRepeat: false,
      allowRecentCoverage: false,
    },
    {
      ...options,
      preferFresh: false,
      requireFresh: false,
      allowSourceRepeat: true,
      allowRecentCoverage: true,
    },
  ];

  for (const attempt of attempts) {
    const ranked = base
      .filter((c) =>
        freshnessOk(
          c,
          now,
          Boolean(attempt.preferFresh),
          Boolean(attempt.requireFresh)
        )
      )
      .filter((c) => {
        if (attempt.allowSourceRepeat) return true;
        const src = normalizeSourceKey(c.story.source);
        if (!src || !attempt.avoidSources?.size) return true;
        return !attempt.avoidSources.has(src);
      })
      .filter((c) => {
        if (!attempt.avoidCategories?.size) return true;
        return !attempt.avoidCategories.has(categoryKey(c));
      })
      .filter((c) => {
        if (attempt.allowRecentCoverage || !recentStoryKeys.length) return true;
        return !matchesRecentCoverage(c.story, recentStoryKeys);
      })
      .sort((a, b) => {
        // Secondary editorial sort: score, then fresher, then quality already in score.
        if (b.score !== a.score) return b.score - a.score;
        const ha = hoursSince(a.story.publishedAt, now);
        const hb = hoursSince(b.story.publishedAt, now);
        if (ha === null && hb === null) return 0;
        if (ha === null) return 1;
        if (hb === null) return -1;
        return ha - hb;
      });

    if (ranked[0]) return ranked[0];
  }

  // Absolute fallback — still prefer unread coverage when any remains.
  const unread = recentStoryKeys.length
    ? base.filter((c) => !matchesRecentCoverage(c.story, recentStoryKeys))
    : base;
  const fallbackPool = unread.length ? unread : base;
  return fallbackPool.sort((a, b) => b.score - a.score)[0] ?? null;
}

function toRanked(c: ScoredCandidate, role: StoryRole): RankedStory {
  return {
    story: c.story,
    score: c.score,
    role,
    reasons: [
      {
        code: `role_${role}`,
        label: roleLabel(role),
        weight: 20,
      },
      ...c.reasons,
    ],
  };
}

function roleLabel(role: StoryRole): string {
  switch (role) {
    case "national":
      return "Major national or world story for the front page";
    case "interest":
      return "Chosen for your strongest interests";
    case "local":
      return "Local or regional relevance";
    case "feature":
      return "Uplifting or interesting feature for balance";
    case "breaking":
      return "Important developing news";
  }
}

/**
 * Build a balanced front page from scored candidates.
 * Target mix: national · interest · local · feature · optional breaking.
 * Applies source diversity, topic diversity, freshness, and duplicate gates.
 */
export function selectFrontPage(
  candidates: ScoredCandidate[],
  ctx: StoryRankingContext
): FrontPageSelection {
  const maxStories = ctx.maxStories ?? 4;
  const now = ctx.now ?? new Date();
  const recentStoryKeys = ctx.recentStoryKeys ?? [];
  const selected: RankedStory[] = [];
  const used = new Set<string>();
  const usedSources = new Set<string>();
  const usedCategories = new Set<string>();

  const take = (c: ScoredCandidate | null, role: StoryRole) => {
    if (!c || used.has(c.story.id)) return;
    if (selected.length >= maxStories) return;
    selected.push(toRanked(c, role));
    used.add(c.story.id);
    const src = normalizeSourceKey(c.story.source);
    if (src) usedSources.add(src);
    usedCategories.add(categoryKey(c));
  };

  const opts = (): PickOptions => ({
    avoidSources: new Set(usedSources),
    avoidCategories: new Set(usedCategories),
    preferFresh: true,
  });

  const pick = (
    predicate: (c: ScoredCandidate) => boolean,
    options: PickOptions = opts()
  ) => pickBest(candidates, selected, predicate, now, options, recentStoryKeys);

  // 1) Major national / world
  take(
    pick(
      (c) =>
        c.story.pool === "general" ||
        /national_importance|breaking|global_scope/.test(
          c.reasons.map((r) => r.code).join(" ")
        )
    ) ?? pick(() => true),
    "national"
  );

  // 2) Strongest interest match — prefer a different topic/source
  take(
    pick(
      (c) =>
        c.reasons.some((r) => r.code === "user_interest") ||
        c.story.pool === "interest" ||
        c.story.pool === "secondary"
    ),
    "interest"
  );

  // 3) Local / regional — keep local even if category overlaps interest
  take(
    pick(
      (c) =>
        c.reasons.some(
          (r) => r.code === "local_relevance" || r.code === "local_pool"
        ) || c.story.pool === "local",
      { ...opts(), avoidCategories: new Set() }
    ),
    "local"
  );

  // 4) Uplifting / feature for tonal balance
  take(
    pick((c) => c.reasons.some((r) => r.code === "feature_tone")) ??
      pick(
        (c) =>
          c.story.category === "science" ||
          c.story.category === "health" ||
          c.story.pool === "secondary"
      ),
    "feature"
  );

  // 5) Optional breaking — only if important enough and distinct
  if (selected.length < maxStories) {
    const breaking = pick(
      (c) =>
        c.score >= 28 &&
        c.reasons.some(
          (r) =>
            r.code === "breaking_language" ||
            r.code === "breaking_fresh" ||
            r.code === "national_importance"
        )
    );
    if (breaking && breaking.score >= 32) {
      take(breaking, "breaking");
    }
  }

  // Fill remaining slots with next-best distinct stories for a complete page.
  while (selected.length < Math.min(maxStories, 3)) {
    const next = pick(() => true);
    if (!next) break;
    const role: StoryRole =
      selected.length === 0
        ? "national"
        : selected.length === 1
        ? "interest"
        : "feature";
    take(next, role);
  }

  // If we somehow lack local+national balance and room remains, try once more.
  if (
    selected.length < maxStories &&
    !selected.some((s) => s.role === "local")
  ) {
    take(
      pick(
        (c) =>
          c.story.pool === "local" ||
          c.reasons.some((r) => r.code === "local_relevance")
      ),
      "local"
    );
  }

  const composition = auditComposition(
    selected.map((s) => ({
      role: s.role,
      source: s.story.source,
      category: s.story.category,
      publishedAt: s.story.publishedAt,
    })),
    now
  );

  const groundingData = formatGrounding(selected, composition.editorNotes);
  const profile = {
    interests: ctx.interests,
    followedTopics: ctx.followedTopics,
    city: ctx.city,
    region: ctx.region,
    state: ctx.state,
  };

  return {
    stories: selected,
    groundingData,
    scoredCandidates: candidates,
    selectionMeta: {
      selectedAt: now.toISOString(),
      profile,
      stories: selected.map((s) => ({
        title: s.story.title,
        role: s.role,
        score: s.score,
        reasons: s.reasons,
        source: s.story.source,
        category: s.story.category,
        publishedAt: s.story.publishedAt,
      })),
      composition,
    },
  };
}

function formatGrounding(
  selected: RankedStory[],
  editorNotes: string[]
): string {
  if (!selected.length) return "";

  const lines = selected.map((s, i) => {
    const why = s.reasons
      .filter((r) => r.code !== `role_${s.role}`)
      .slice(0, 2)
      .map((r) => r.label)
      .join("; ");
    return (
      `${i + 1}. [${s.role}] ${s.story.title} (${s.story.source})` +
      `\n   ${s.story.description || "(no summary provided)"}` +
      (why ? `\n   Why selected: ${why}` : "")
    );
  });

  const compositionLine = editorNotes.length
    ? `\nEditorial composition: ${editorNotes.join("; ")}.`
    : "";

  return (
    "Balanced front page for today’s edition (do not invent stories):\n" +
    lines.join("\n") +
    compositionLine +
    "\nWrite as a thoughtfully curated morning newspaper — calm, intentional, never algorithmic."
  );
}
