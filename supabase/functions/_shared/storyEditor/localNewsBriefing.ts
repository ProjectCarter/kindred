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
import type { StorySelectionReason } from "../stories/types.ts";
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
                "Write a complete morning briefing — not a wire reprint.",
                "Cover what happened, local relevance, key details, community impact, and what's next when the source supports each.",
                "Maintain attribution to the original publisher.",
              ],
              avoidPatterns: [
                "copying source sentences verbatim",
                "invented local color",
                "speculation about motives or outcomes",
                "clickbait or sensational language",
                "repeating the same idea in different words",
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
  const dek = edited.dek?.trim();
  if (dek) return dek;
  const first = edited.paragraphs[0]?.trim();
  if (first && first.length <= 220) return first;
  if (first) return `${first.slice(0, 217).trim()}…`;
  return fallback;
}

function mapFrontStoryToDesk(
  ranked: LocalNewsFrontStory,
  edited: StoryEditorResult
): LocalNewsDeskStory {
  const wireSummary =
    ranked.story.description?.trim() || ranked.story.title.trim();
  return {
    id: ranked.story.id,
    title: edited.headline || ranked.story.title,
    description: edited.bodyText || wireSummary,
    dek: edited.dek ?? cardSummaryFromEdit(edited, wireSummary),
    body: edited.paragraphs,
    url: ranked.story.url,
    imageUrl: ranked.story.imageUrl ?? null,
    role: "local",
    score: ranked.score,
    reasons: ranked.reasons,
    source: ranked.story.source,
    category: ranked.story.category ?? null,
    publishedAt: ranked.story.publishedAt,
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
export async function enrichLocalNewsEditorial(
  input: EnrichLocalNewsEditorialInput
): Promise<EnrichLocalNewsEditorialResult> {
  const { editorial, place, anthropicApiKey } = input;
  let leadStory = promoteLocalLeadFromFrontPage(editorial, {
    recentStoryKeys: input.recentStoryKeys,
    place: { ...place, metroKey: input.metroKey },
  });

  if (leadStory && isLocalNewsRole(leadStory.role)) {
    const intake = buildLocalNewsIntake({
      id: leadStory.id,
      headline: leadStory.headline,
      sourceText: leadStory.summary || leadStory.headline,
      source: leadStory.source,
      url: leadStory.url,
      publishedAt: leadStory.publishedAt,
      role: leadStory.role,
      placement: "lead",
      place,
      selectionWhy: leadStory.selection.reasons.map((r) => r.label).slice(0, 4),
    });
    const edited = await editLocalNewsStory(intake, anthropicApiKey);
    const cardSummary = cardSummaryFromEdit(edited, leadStory.summary);
    leadStory = {
      ...leadStory,
      headline: edited.headline || leadStory.headline,
      summary: cardSummary,
      body: edited.paragraphs,
      dek: edited.dek ?? cardSummary,
      desk: edited.desk as unknown as Record<string, unknown>,
    };
    console.log("[localNewsBriefing] lead", {
      id: leadStory.id.slice(0, 48),
      path: edited.desk.path,
      paras: edited.paragraphs.length,
      thin: isThinSource(intake.sourceText),
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
