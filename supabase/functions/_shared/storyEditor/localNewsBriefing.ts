/**
 * Local News briefing — Kindred morning newspaper desk for wire stories.
 * Summarizes verified reporting; never copies or rewrites entire articles.
 */

import type { LeadStory } from "../leadStory/types.ts";
import type { EditorialDecisionsResult } from "../editor/decide.ts";
import { buildEditionEditorialContext } from "../editorial/buildEditorialContext.ts";
import type { EditionEditorialContext } from "../editorial/types.ts";
import { buildConsultationPack } from "./consultation.ts";
import { LOCAL_NEWS_BRIEFING_DIGEST } from "./constitutions.ts";
import { runStoryEditorSafe } from "./runStoryEditor.ts";
import type { StoryEditorIntake, StoryEditorResult, StorySurfaceRole } from "./types.ts";
import { composeLocalNewsThinHonest } from "./thinFallback.ts";
import { isThinSource } from "./validators.ts";
import { isPublishableLocalNewsStory, cardSummaryFromEdit as cardSummaryFromEditShared } from "./localNewsPublish.ts";
import type { StorySelectionReason } from "../stories/types.ts";
import {
  assessLocalNewsGeographicEligibility,
  geographicTierPriority,
} from "../../../../lib/edition/localNewsGeographicEligibility.ts";
import { localLeadAgeBand } from "../../../../lib/edition/localNewsFreshness.ts";
import {
  localNewsDeskBadge,
  selectLocalNewsDeskLead,
  type LocalNewsContentType,
} from "../../../../lib/edition/localNewsDesk.ts";

export type LocalNewsReaderPlace = {
  city: string | null;
  region: string | null;
  state: string | null;
};

export type LocalNewsFrontStory = EditorialDecisionsResult["frontPage"]["stories"][number];

export type LocalNewsDeskStory = {
  id: string;
  title: string;
  description: string;
  dek: string | null;
  body: string[];
  url: string | null;
  imageUrl: string | null;
  role: string;
  score: number;
  reasons: LocalNewsFrontStory["reasons"];
  source: string;
  category: string | null;
  publishedAt: string | null;
  desk?: Record<string, unknown> | null;
};

export function isLocalNewsRole(role: string | null | undefined): boolean {
  return /local/i.test(role ?? "");
}

export function localNewsSurfaceRole(
  role: string,
  placement: "lead" | "top_story"
): StorySurfaceRole {
  if (isLocalNewsRole(role)) return "local_news";
  return placement === "lead" ? "lead" : "top_story";
}

function cleanHeadline(title: string): string {
  return title.replace(/\s+[—–|-]\s+[^—–|-]+$/, "").trim();
}

function conciseWireSummary(description: string, title: string): string {
  const raw = (description || title).replace(/\s+/g, " ").trim();
  if (raw.length <= 220) return raw;
  return `${raw.slice(0, 217).trim()}…`;
}

export type PromoteLocalLeadOptions = {
  recentStoryKeys?: string[];
  now?: Date;
  place?: LocalNewsReaderPlace & { metroKey?: string | null };
};

function matchesRecentLocalLeadKeys(
  candidate: {
    id: string;
    url?: string | null;
    headline?: string | null;
  },
  recentKeys: string[]
): boolean {
  if (!recentKeys.length) return false;
  if (recentKeys.includes(candidate.id)) return true;
  const url = candidate.url?.trim();
  if (url && recentKeys.includes(url)) return true;
  const headline = candidate.headline?.trim();
  if (headline && recentKeys.includes(headline)) return true;
  return false;
}

/**
 * When the lead selector returns null, promote a fresh front-page story.
 * Respects the same age bands as selectLeadStory — never recycles a stale wire
 * when nothing qualifies (homepage shows the empty-state instead).
 */
export function promoteLocalLeadFromFrontPage(
  editorial: EditorialDecisionsResult,
  options: PromoteLocalLeadOptions = {}
): LeadStory | null {
  const recentStoryKeys = options.recentStoryKeys ?? [];
  const now = options.now ?? new Date();

  const place = options.place;
  const deskCandidates = [
    ...(editorial.leadStory
      ? [
          {
            id: editorial.leadStory.id,
            publishedAt: editorial.leadStory.publishedAt,
            source: editorial.leadStory.source,
            url: editorial.leadStory.url,
            title: editorial.leadStory.headline,
            description: editorial.leadStory.summary,
            category: null as string | null,
            score: editorial.leadStory.selection.score,
          },
        ]
      : []),
    ...editorial.frontPage.stories.map((s) => ({
      id: s.story.id,
      publishedAt: s.story.publishedAt,
      source: s.story.source,
      url: s.story.url,
      title: s.story.title,
      description: s.story.description,
      category: s.story.category ?? null,
      score: s.score,
    })),
  ];

  const chosen = selectLocalNewsDeskLead(deskCandidates, {
    now,
    recentStoryKeys,
    minScore: 0,
    place,
    isRecentCoverage: (c, keys) =>
      matchesRecentLocalLeadKeys(
        {
          id: c.id,
          url: c.url,
          headline: c.title ?? null,
        },
        keys
      ),
  });

  if (!chosen) {
    console.log("[localNewsDesk] promote — empty desk", {
      candidateCount: deskCandidates.length,
      recentKeyCount: recentStoryKeys.length,
    });
    return null;
  }

  const contentType: LocalNewsContentType = chosen.contentType;
  const deskBadge = localNewsDeskBadge(contentType);
  console.log("[localNewsDesk] content type selected", {
    contentType,
    deskBadge,
    storyId: chosen.candidate.id,
    publishedAt: chosen.candidate.publishedAt,
    source: chosen.candidate.source,
    path: "promoteLocalLeadFromFrontPage",
  });

  if (editorial.leadStory?.id === chosen.candidate.id) {
    const lead = editorial.leadStory;
    return {
      ...(isLocalNewsRole(lead.role) ? lead : { ...lead, role: "local" as const }),
      contentType: lead.contentType ?? contentType,
      deskBadge: lead.deskBadge ?? deskBadge,
    };
  }

  const ranked = editorial.frontPage.stories.find(
    (s) => s.story.id === chosen.candidate.id
  );
  if (!ranked) return null;

  const imageUri = ranked.story.imageUrl?.trim() || null;
  const headline = cleanHeadline(ranked.story.title);
  return {
    id: ranked.story.id,
    headline,
    summary: conciseWireSummary(ranked.story.description, ranked.story.title),
    source: ranked.story.source,
    url: ranked.story.url,
    publishedAt: ranked.story.publishedAt,
    role: "local",
    contentType,
    deskBadge,
    heroImage: {
      uri: imageUri,
      alt: headline,
      source: imageUri ? "article" : "none",
    },
    banditsPick: { reserved: true, isBanditsPick: false },
    selection: {
      score: ranked.score,
      reasons: ranked.reasons as StorySelectionReason[],
      belowFoldTitles: editorial.frontPage.stories
        .filter((s) => s.story.id !== ranked.story.id)
        .map((s) => s.story.title),
      strategy: "prefer_local",
    },
  };
}

function mapWireFrontPageToDesk(
  editorial: EditorialDecisionsResult
): LocalNewsDeskStory[] {
  return editorial.frontPage.stories
    .filter((ranked) => localLeadAgeBand(ranked.story.publishedAt) !== "stale")
    .map((ranked) => {
      const wireSummary =
        ranked.story.description?.trim() || ranked.story.title.trim();
      return {
        id: ranked.story.id,
        title: cleanHeadline(ranked.story.title),
        description: wireSummary,
        dek: null,
        body: wireSummary ? [wireSummary] : [],
        url: ranked.story.url,
        imageUrl: ranked.story.imageUrl ?? null,
        // Local desk slate — always publish as local for the homepage filter.
        role: "local",
        score: ranked.score,
        reasons: ranked.reasons,
        source: ranked.story.source,
        category: ranked.story.category ?? null,
        publishedAt: ranked.story.publishedAt,
      };
    });
}

function buildLocalNewsEditorialContext(input: {
  editionDate: string;
  place: LocalNewsReaderPlace;
  interests: string[];
  followedTopics?: string[];
  editorial: EditorialDecisionsResult;
  deskStories: LocalNewsDeskStory[];
}): EditionEditorialContext {
  return buildEditionEditorialContext({
    editionDate: input.editionDate,
    location: {
      city: input.place.city,
      region: input.place.region,
      state: input.place.state,
    },
    interests: input.interests,
    followedTopics: input.followedTopics ?? [],
    frontPage: {
      stories: input.deskStories.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        dek: s.dek,
        url: s.url,
        imageUrl: s.imageUrl,
        role: s.role,
        score: s.score,
        source: s.source,
        category: s.category,
        publishedAt: s.publishedAt,
        reasons: s.reasons,
        body: s.body,
        desk: s.desk ?? null,
      })),
      composition: input.editorial.frontPage.selectionMeta.composition ?? null,
      editorialDecisions: input.editorial.decisions,
    },
    now: new Date(),
  });
}

/**
 * Wire-only fallback when Story Editor enrichment fails — still persists local news.
 */
export function buildUnenrichedLocalNews(
  input: Omit<EnrichLocalNewsEditorialInput, "anthropicApiKey"> & {
    reason: string;
  }
): EnrichLocalNewsEditorialResult {
  const leadStory = promoteLocalLeadFromFrontPage(input.editorial, {
    recentStoryKeys: input.recentStoryKeys,
    place: { ...input.place, metroKey: input.metroKey },
  });
  const deskStories = mapWireFrontPageToDesk(input.editorial);
  console.warn("[localNewsBriefing] wire fallback", {
    reason: input.reason,
    lead: leadStory?.headline?.slice(0, 60) ?? null,
    deskCount: deskStories.length,
  });
  return {
    leadStory,
    deskStories,
    editorialContext: buildLocalNewsEditorialContext({
      editionDate: input.editionDate,
      place: input.place,
      interests: input.interests,
      followedTopics: input.followedTopics,
      editorial: input.editorial,
      deskStories,
    }),
  };
}

function placeLabel(place: LocalNewsReaderPlace): string {
  const parts = [place.city, place.region, place.state].filter(Boolean);
  return parts.join(", ") || "the reader's area";
}

function buildLocalNewsIntake(input: {
  id: string;
  headline: string;
  sourceText: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  role: string;
  placement: "lead" | "top_story";
  place: LocalNewsReaderPlace;
  selectionWhy?: string[];
}): StoryEditorIntake {
  const locale = "en";
  return {
    id: input.id,
    headline: input.headline,
    sourceText: input.sourceText,
    source: input.source,
    url: input.url,
    publishedAt: input.publishedAt,
    surfaceRole: localNewsSurfaceRole(input.role, input.placement),
    locale,
    readerPlace: input.place,
    selectionWhy: input.selectionWhy,
    consultation: buildConsultationPack({
      surfaceRole: localNewsSurfaceRole(input.role, input.placement),
      locale,
      learningHints:
        localNewsSurfaceRole(input.role, input.placement) === "local_news"
          ? {
              playbookHints: [
                `Reader place: ${placeLabel(input.place)}.`,
                "Kindred is a newspaper — never fabricate quotes, stats, timelines, interviews, eyewitness accounts, attributed opinions, unreported causes, or future events as fact.",
                "Classify the story first (sports, local_government, business, community, public_safety, general), then write to that desk's sections.",
                "Lead with source-verified journalism — never repeat the headline or paraphrase the wire in place of context.",
                "On thin wires, add verified general background (what training camp is, why a council vote matters) — distinguish source facts from general education.",
                "Use looking_ahead for watch-for framing only — hedged, never predictive certainty.",
                "Keep disclaimers out of the body; attribution goes in four_questions.limits only.",
              ],
              avoidPatterns: [
                "fabricated quotes, statistics, timelines, or attributed opinions",
                "story-specific details not in the source",
                "unreported causes or outcomes presented as fact",
                "future events stated with certainty",
                "repeating the headline in the opening paragraph",
                "paraphrasing the wire without adding verified background",
                "copying source sentences verbatim",
                "invented local color or speculation",
                "clickbait or sensational language",
                "Kindred summary or will not invent disclaimers in the body",
              ],
            }
          : null,
    }),
  };
}

async function editLocalNewsStory(
  intake: StoryEditorIntake,
  apiKey: string | null | undefined
): Promise<StoryEditorResult> {
  if (!apiKey) {
    if (intake.surfaceRole === "local_news") {
      return composeLocalNewsThinHonest(intake, "Story Editor unavailable — honest wire briefing.");
    }
    return runStoryEditorSafe(intake, apiKey);
  }
  return runStoryEditorSafe(intake, apiKey);
}

function cardSummaryFromEdit(
  edited: StoryEditorResult,
  fallback: string
): string {
  return cardSummaryFromEditShared(edited, fallback);
}

function mapFrontStoryToDesk(
  ranked: LocalNewsFrontStory,
  edited: StoryEditorResult
): LocalNewsDeskStory {
  const wireSummary =
    ranked.story.description?.trim() || ranked.story.title.trim();
  const cardSummary = cardSummaryFromEdit(edited, wireSummary);
  return {
    id: ranked.story.id,
    title: edited.headline || ranked.story.title,
    description: edited.bodyText || wireSummary,
    dek: edited.dek ?? cardSummary,
    body: edited.paragraphs,
    url: ranked.story.url,
    imageUrl: ranked.story.imageUrl ?? null,
    role: "local",
    score: ranked.score,
    reasons: ranked.reasons,
    source: ranked.story.source,
    category: ranked.story.category ?? null,
    publishedAt: ranked.story.publishedAt,
    desk: edited.desk as unknown as Record<string, unknown>,
  };
}

export type EnrichLocalNewsEditorialInput = {
  editorial: EditorialDecisionsResult;
  place: LocalNewsReaderPlace;
  editionDate: string;
  interests: string[];
  followedTopics?: string[];
  anthropicApiKey: string | null | undefined;
  recentStoryKeys?: string[];
  metroKey?: string | null;
};

export type EnrichLocalNewsEditorialResult = {
  leadStory: LeadStory | null;
  deskStories: LocalNewsDeskStory[];
  editorialContext: EditionEditorialContext;
};

/**
 * Run the Local News briefing desk on lead + front-page stories, then assemble
 * editorial_context for the client reader adapters.
 */
function orderedLocalLeadCandidates(
  editorial: EditorialDecisionsResult,
  options: PromoteLocalLeadOptions = {}
): Array<{
  id: string;
  publishedAt?: string | null;
  source?: string | null;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  score: number;
  role?: string | null;
  headline?: string | null;
  summary?: string | null;
  heroImage?: LeadStory["heroImage"];
  selection?: LeadStory["selection"];
}> {
  const place = options.place ?? {};
  const base = [
    ...(editorial.leadStory
      ? [
          {
            id: editorial.leadStory.id,
            publishedAt: editorial.leadStory.publishedAt,
            source: editorial.leadStory.source,
            url: editorial.leadStory.url,
            title: editorial.leadStory.headline,
            description: editorial.leadStory.summary,
            category: null as string | null,
            score: editorial.leadStory.selection.score,
            role: editorial.leadStory.role,
            headline: editorial.leadStory.headline,
            summary: editorial.leadStory.summary,
            heroImage: editorial.leadStory.heroImage,
            selection: editorial.leadStory.selection,
          },
        ]
      : []),
    ...editorial.frontPage.stories.map((s) => ({
      id: s.story.id,
      publishedAt: s.story.publishedAt,
      source: s.story.source,
      url: s.story.url,
      title: s.story.title,
      description: s.story.description,
      category: s.story.category ?? null,
      score: s.score,
      role: "local" as const,
      headline: s.story.title,
      summary: s.story.description,
      heroImage: s.story.imageUrl
        ? { uri: s.story.imageUrl, alt: s.story.title }
        : undefined,
      selection: {
        score: s.score,
        reasons: s.reasons,
      },
    })),
  ];

  const seen = new Set<string>();
  return base
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .map((c) => ({
      candidate: c,
      geo: assessLocalNewsGeographicEligibility({
        id: c.id,
        title: c.title ?? "",
        description: c.description,
        source: c.source,
        category: c.category,
        score: c.score,
        place,
      }),
    }))
    .filter(({ geo }) => geo.eligible)
    .sort(
      (a, b) =>
        geographicTierPriority(b.geo.geographicTier) -
          geographicTierPriority(a.geo.geographicTier) ||
        b.candidate.score - a.candidate.score
    )
    .map(({ candidate, geo }) => {
      console.log("[localNewsBriefing] lead candidate", {
        id: candidate.id.slice(0, 48),
        title: (candidate.title ?? "").slice(0, 72),
        tier: geo.geographicTier,
        reason: geo.eligibilityReason,
      });
      return candidate;
    });
}

export async function enrichLocalNewsEditorial(
  input: EnrichLocalNewsEditorialInput
): Promise<EnrichLocalNewsEditorialResult> {
  const { editorial, place, anthropicApiKey } = input;
  let leadStory: LeadStory | null = null;
  const leadCandidates = orderedLocalLeadCandidates(editorial, {
    recentStoryKeys: input.recentStoryKeys,
    place: { ...place, metroKey: input.metroKey },
  });

  for (const candidate of leadCandidates) {
    const headline = candidate.headline ?? candidate.title ?? "";
    const summary =
      candidate.summary ??
      conciseWireSummary(candidate.description ?? "", headline);
    const intake = buildLocalNewsIntake({
      id: candidate.id,
      headline,
      sourceText: summary || headline,
      source: candidate.source ?? "Unknown",
      url: candidate.url ?? null,
      publishedAt: candidate.publishedAt ?? null,
      role: candidate.role ?? "local",
      placement: "lead",
      place,
    });
    const edited = await editLocalNewsStory(intake, anthropicApiKey);
    if (
      !isPublishableLocalNewsStory(edited, {
        title: headline,
        description: candidate.description ?? summary,
      })
    ) {
      console.warn("[localNewsBriefing] lead rejected — insufficient verified material", {
        id: candidate.id.slice(0, 48),
        path: edited.desk.path,
        tierAttempt: leadCandidates.indexOf(candidate) + 1,
      });
      continue;
    }
    const cardSummary = cardSummaryFromEdit(edited, summary);
    const chosen = selectLocalNewsDeskLead(
      [
        {
          id: candidate.id,
          publishedAt: candidate.publishedAt,
          source: candidate.source,
          url: candidate.url,
          title: candidate.title,
          description: candidate.description,
          category: candidate.category,
          score: candidate.score,
        },
      ],
      {
        place: { ...place, metroKey: input.metroKey },
        recentStoryKeys: input.recentStoryKeys ?? [],
        isRecentCoverage: () => false,
      }
    );
    const contentType = chosen?.contentType ?? "local_news";
    const deskBadge = localNewsDeskBadge(contentType);
    leadStory = {
      id: candidate.id,
      headline: edited.headline || headline,
      summary: cardSummary,
      body: edited.paragraphs,
      dek: edited.dek ?? cardSummary,
      desk: edited.desk as unknown as Record<string, unknown>,
      role: "local",
      contentType,
      deskBadge,
      source: candidate.source ?? "Unknown",
      url: candidate.url ?? null,
      publishedAt: candidate.publishedAt ?? null,
      heroImage: candidate.heroImage ?? { uri: null, alt: headline },
      selection: candidate.selection ?? {
        score: candidate.score,
        reasons: [],
      },
    };
    console.log("[localNewsBriefing] lead", {
      id: leadStory.id.slice(0, 48),
      path: edited.desk.path,
      paras: edited.paragraphs.length,
      thin: isThinSource(intake.sourceText),
      tierAttempt: leadCandidates.indexOf(candidate) + 1,
    });
    break;
  }

  if (!leadStory) {
    leadStory = promoteLocalLeadFromFrontPage(editorial, {
      recentStoryKeys: input.recentStoryKeys,
      place: { ...place, metroKey: input.metroKey },
    });
  }

  const deskStories: LocalNewsDeskStory[] = [];
  for (const ranked of editorial.frontPage.stories) {
    if (localLeadAgeBand(ranked.story.publishedAt) === "stale") continue;
    const wireSummary =
      ranked.story.description?.trim() || ranked.story.title.trim();
    // Entire slate came from the local desk — brief every story as local news.
    const intake = buildLocalNewsIntake({
      id: ranked.story.id,
      headline: ranked.story.title,
      sourceText: wireSummary,
      source: ranked.story.source,
      url: ranked.story.url,
      publishedAt: ranked.story.publishedAt,
      role: "local",
      placement: "top_story",
      place,
      selectionWhy: ranked.reasons.map((r) => r.label).slice(0, 3),
    });
    const edited = await editLocalNewsStory(intake, anthropicApiKey);
    if (
      !isPublishableLocalNewsStory(edited, {
        title: ranked.story.title,
        description: wireSummary,
      })
    ) {
      console.warn("[localNewsBriefing] top_story rejected — insufficient verified material", {
        id: ranked.story.id.slice(0, 48),
        path: edited.desk.path,
      });
      continue;
    }
    deskStories.push(mapFrontStoryToDesk(ranked, edited));
    console.log("[localNewsBriefing] top_story", {
      id: ranked.story.id.slice(0, 48),
      path: edited.desk.path,
      paras: edited.paragraphs.length,
    });
  }

  const editorialContext = buildLocalNewsEditorialContext({
    editionDate: input.editionDate,
    place,
    interests: input.interests,
    followedTopics: input.followedTopics,
    editorial,
    deskStories,
  });

  return { leadStory, deskStories, editorialContext };
}

export { LOCAL_NEWS_BRIEFING_DIGEST };
