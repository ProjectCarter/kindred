import { fetchStoryCandidates, fetchLocalStoryCandidates } from "../stories/fetchCandidates.ts";
import { scoreCandidate, type ScoredCandidate } from "../stories/score.ts";
import { selectFrontPage } from "../stories/selectFrontPage.ts";
import { matchesRecentCoverage } from "../stories/diversity.ts";
import { selectLeadStory } from "../leadStory/selectLeadStory.ts";
import type { LeadStory } from "../leadStory/types.ts";
import type {
  FrontPageSelection,
  StoryRankingContext,
} from "../stories/types.ts";
import { policyForEditionDate } from "./policy.ts";
import { summarizeEditorialDecisions } from "./whyChosen.ts";
import type {
  EditorialCalendar,
  EditorialDecisionSummary,
  EditorialPolicy,
} from "./types.ts";
import { isUpliftingStory, shouldDeprioritizeForTone } from "./tone.ts";

export type RunEditorialDecisionsInput = {
  ranking: StoryRankingContext;
  newsApiKey: string;
  editionDate: string;
};

export type EditorialDecisionsResult = {
  frontPage: FrontPageSelection;
  leadStory: LeadStory | null;
  calendar: EditorialCalendar;
  policy: EditorialPolicy;
  decisions: EditorialDecisionSummary;
};

/**
 * Newspaper Editor AI — assemble today’s paper intentionally.
 * Fetch → score with editorial policy → lead judgment → balanced slate.
 * Reusable by every future section that needs editorial curation.
 */
export async function runEditorialDecisions(
  input: RunEditorialDecisionsInput
): Promise<EditorialDecisionsResult> {
  const now = input.ranking.now ?? new Date();
  const { calendar, policy } = policyForEditionDate(
    input.editionDate,
    now,
    input.ranking.maxStories ?? 4
  );

  const ranking: StoryRankingContext = {
    ...input.ranking,
    now,
    maxStories: policy.maxStories,
    editorial: {
      calendar,
      policy,
    },
  };

  const candidates = await fetchStoryCandidates(ranking, input.newsApiKey);
  const scored = candidates
    .map((story) => scoreCandidate(story, ranking))
    .sort((a, b) => b.score - a.score);

  // 1) Lead first — cover judgment, not leftover from the slate.
  const provisionalSlate = selectFrontPage(scored, ranking, policy);
  const leadStory = selectLeadStory(
    {
      topStories: provisionalSlate.stories,
      scoredCandidates: scored,
      localScoreThreshold: calendar.isWeekend ? 20 : 22,
      recentStoryKeys: ranking.recentStoryKeys ?? [],
    },
    {
      preferWeekendFeature: policy.preferLeisureTone,
      excludeFromBelowFold: policy.leadDistinctFromSlate,
      editionMode: policy.mode,
    }
  );

  // 2) Rebuild Top Stories excluding the Lead when possible.
  const excludeIds = new Set<string>();
  if (leadStory && policy.leadDistinctFromSlate) {
    excludeIds.add(leadStory.id);
  }

  const poolForSlate = scored.filter((c) => !excludeIds.has(c.story.id));
  let frontPage = selectFrontPage(poolForSlate, ranking, policy);

  // 3) Emotional balance pass — if the slate is too heavy, force a feature.
  frontPage = ensureEmotionalBalance(frontPage, poolForSlate, ranking, policy);

  // Attach full scored pool (including lead candidates) for downstream.
  frontPage = {
    ...frontPage,
    scoredCandidates: scored,
  };

  const leadScored: ScoredCandidate | null = leadStory
    ? scored.find((c) => c.story.id === leadStory.id) ?? {
        story: {
          id: leadStory.id,
          title: leadStory.headline,
          description: leadStory.summary,
          source: leadStory.source,
          url: leadStory.url,
          publishedAt: leadStory.publishedAt,
          imageUrl: leadStory.heroImage.uri,
          category: null,
          pool: "general" as const,
        },
        score: leadStory.selection.score,
        reasons: leadStory.selection.reasons,
      }
    : null;

  const decisions = summarizeEditorialDecisions({
    calendar,
    policy,
    lead: leadScored,
    leadRole: leadStory?.role,
    slate: frontPage.stories.map((s) => ({
      story: s.story,
      score: s.score,
      role: s.role,
      reasons: s.reasons,
    })),
  });

  // Enrich selection meta with editor decisions (invisible to UI layout).
  frontPage = {
    ...frontPage,
    groundingData: enrichGrounding(frontPage.groundingData, decisions),
    selectionMeta: {
      ...frontPage.selectionMeta,
      editorialDecisions: decisions,
    },
  };

  console.log("[editor] decisions", {
    mode: policy.mode,
    lead: leadStory?.headline?.slice(0, 60) ?? null,
    leadRole: leadStory?.role ?? null,
    slateRoles: frontPage.stories.map((s) => s.role),
    tones: decisions.slate.map((s) => s.tone),
    notes: decisions.editorNotes,
  });

  return {
    frontPage,
    leadStory,
    calendar,
    policy,
    decisions,
  };
}

/**
 * Local news desk only — city-specific lead and top stories.
 * National coverage comes from the shared U.S. national daily layer.
 */
export async function runLocalEditorialDecisions(
  input: RunEditorialDecisionsInput
): Promise<EditorialDecisionsResult> {
  const now = input.ranking.now ?? new Date();
  const { calendar, policy } = policyForEditionDate(
    input.editionDate,
    now,
    input.ranking.maxStories ?? 4
  );

  const ranking: StoryRankingContext = {
    ...input.ranking,
    now,
    maxStories: policy.maxStories,
    editorial: {
      calendar,
      policy,
    },
  };

  const candidates = await fetchLocalStoryCandidates(ranking, input.newsApiKey);
  const scored = candidates
    .map((story) => scoreCandidate(story, ranking))
    .filter(
      (c) =>
        c.story.pool === "local" ||
        c.reasons.some(
          (r) => r.code === "local_relevance" || r.code === "local_pool"
        )
    )
    .sort((a, b) => b.score - a.score);

  const provisionalSlate = selectFrontPage(scored, ranking, policy);
  const leadStory = selectLeadStory(
    {
      topStories: provisionalSlate.stories,
      scoredCandidates: scored,
      localScoreThreshold: calendar.isWeekend ? 18 : 20,
      recentStoryKeys: ranking.recentStoryKeys ?? [],
    },
    {
      preferWeekendFeature: false,
      excludeFromBelowFold: policy.leadDistinctFromSlate,
      editionMode: policy.mode,
      localOnly: true,
    }
  );

  const excludeIds = new Set<string>();
  if (leadStory && policy.leadDistinctFromSlate) {
    excludeIds.add(leadStory.id);
  }

  const poolForSlate = scored.filter((c) => !excludeIds.has(c.story.id));
  let frontPage = selectFrontPage(poolForSlate, ranking, policy);
  frontPage = ensureEmotionalBalance(frontPage, poolForSlate, ranking, policy);
  frontPage = {
    ...frontPage,
    scoredCandidates: scored,
  };

  const leadScored: ScoredCandidate | null = leadStory
    ? scored.find((c) => c.story.id === leadStory.id) ?? null
    : null;

  const decisions = summarizeEditorialDecisions({
    calendar,
    policy,
    lead: leadScored,
    leadRole: leadStory?.role,
    slate: frontPage.stories.map((s) => ({
      story: s.story,
      score: s.score,
      role: s.role,
      reasons: s.reasons,
    })),
  });

  frontPage = {
    ...frontPage,
    groundingData: enrichGrounding(frontPage.groundingData, decisions),
    selectionMeta: {
      ...frontPage.selectionMeta,
      editorialDecisions: decisions,
    },
  };

  console.log("[editor] local decisions", {
    mode: policy.mode,
    lead: leadStory?.headline?.slice(0, 60) ?? null,
    leadRole: leadStory?.role ?? null,
    slateRoles: frontPage.stories.map((s) => s.role),
    localPoolSize: scored.length,
  });

  return {
    frontPage,
    leadStory,
    calendar,
    policy,
    decisions,
  };
}

function ensureEmotionalBalance(
  frontPage: FrontPageSelection,
  pool: ScoredCandidate[],
  ranking: StoryRankingContext,
  policy: EditorialPolicy
): FrontPageSelection {
  if (!policy.requireEmotionalBalance) return frontPage;

  const heavy = frontPage.stories.filter((s) =>
    shouldDeprioritizeForTone(`${s.story.title} ${s.story.description}`)
  ).length;
  const hasLift = frontPage.stories.some(
    (s) =>
      s.role === "feature" ||
      isUpliftingStory(`${s.story.title} ${s.story.description}`)
  );

  if (heavy <= policy.maxHeavyStories && hasLift) return frontPage;
  if (frontPage.stories.length === 0) return frontPage;

  // Replace the least essential heavy non-local story with a feature uplift.
  const used = new Set(frontPage.stories.map((s) => s.story.id));
  const recentKeys = ranking.recentStoryKeys ?? [];
  const upliftPool = pool
    .filter((c) => !used.has(c.story.id))
    .filter(
      (c) =>
        isUpliftingStory(`${c.story.title} ${c.story.description}`) ||
        c.reasons.some((r) => r.code === "feature_tone") ||
        c.story.category === "science" ||
        c.story.category === "health"
    )
    .sort((a, b) => b.score - a.score);
  const unreadUplift = recentKeys.length
    ? upliftPool.filter((c) => !matchesRecentCoverage(c.story, recentKeys))
    : upliftPool;
  const uplift = (unreadUplift[0] ?? upliftPool[0]) ?? null;

  if (!uplift) return frontPage;

  const replaceIdx = frontPage.stories.findIndex(
    (s) =>
      s.role !== "local" &&
      s.role !== "breaking" &&
      shouldDeprioritizeForTone(`${s.story.title} ${s.story.description}`)
  );
  if (replaceIdx < 0) {
    // Swap last non-local if no heavy found but lift missing.
    if (hasLift) return frontPage;
    const last = frontPage.stories.length - 1;
    if (frontPage.stories[last]?.role === "local") return frontPage;
    const nextStories = [...frontPage.stories];
    nextStories[last] = {
      story: uplift.story,
      score: uplift.score,
      role: "feature",
      reasons: [
        {
          code: "role_feature",
          label: "Feature for tonal balance — emotional counterweight",
          weight: 20,
        },
        {
          code: "emotional_counterweight",
          label: "Editor added lift so the page isn’t only hard news",
          weight: 18,
        },
        ...uplift.reasons,
      ],
    };
    return rebuildMeta({ ...frontPage, stories: nextStories }, ranking);
  }

  const nextStories = [...frontPage.stories];
  nextStories[replaceIdx] = {
    story: uplift.story,
    score: uplift.score,
    role: "feature",
    reasons: [
      {
        code: "role_feature",
        label: "Feature for tonal balance — emotional counterweight",
        weight: 20,
      },
      {
        code: "emotional_counterweight",
        label: "Editor added lift so the page isn’t only hard news",
        weight: 18,
      },
      ...uplift.reasons,
    ],
  };
  return rebuildMeta({ ...frontPage, stories: nextStories }, ranking);
}

function rebuildMeta(
  frontPage: FrontPageSelection,
  ranking: StoryRankingContext
): FrontPageSelection {
  return {
    ...frontPage,
    selectionMeta: {
      ...frontPage.selectionMeta,
      selectedAt: (ranking.now ?? new Date()).toISOString(),
      stories: frontPage.stories.map((s) => ({
        title: s.story.title,
        role: s.role,
        score: s.score,
        reasons: s.reasons,
        source: s.story.source,
        category: s.story.category,
        publishedAt: s.story.publishedAt,
      })),
    },
  };
}

function enrichGrounding(
  grounding: string,
  decisions: EditorialDecisionSummary
): string {
  const notes = decisions.editorNotes.slice(0, 4).join("; ");
  return (
    grounding +
    `\nEditorial judgment: ${decisions.calendar.modeLabel}.` +
    (notes ? ` ${notes}.` : "") +
    "\nWrite as a thoughtfully curated morning newspaper — assembled by an editor, never by an algorithm."
  );
}
