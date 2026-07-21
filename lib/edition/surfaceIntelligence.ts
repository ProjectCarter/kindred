/**
 * Derive user-visible newspaper surfaces from stored engine payloads.
 * Keeps screens thin — no new backend.
 */

import {
  banditSeasonalLine,
  banditWeeklyLine,
  banditsPick,
  parseBanditPayload,
  type BanditsPick,
} from "./bandit";
import { isBanditsPicksEnabled } from "./banditsPicksFeature";
import {
  discoveryItemsForSurface,
  parseDiscoveryPayload,
  type DiscoveryPayload,
  type RankedDiscoveryItem,
} from "./discovery";
import {
  parseKnowledgePayload,
  whyThisMatters,
  type KnowledgeFacetType,
  type KnowledgePacket,
  type KnowledgePayload,
} from "./knowledge";
import {
  parseMemoryPayload,
  sinceYouLastRead as memorySinceYouLastRead,
  memoryForStory,
  type MemoryPayload,
} from "./memory";
import {
  parseMorningEditionPayload,
  requestMorningBriefing,
  morningHeroFromEdition,
  type MorningBriefing,
  type MorningEditionPayload,
} from "./morningEdition";
import { extractWeatherSummaryFromEditorialContext } from "../weather/parseWeatherSummary";
import type { MorningHeroExperience } from "./heroArtwork/types";
import type { LeadStory } from "./LeadStory";
import type { ArticleCompanion, KnowledgeNote } from "./articleCompanion";
import type { KindredArticle } from "./article";
import {
  parseHistoryAroundTownPayload,
  type HistoryAroundTownEditionPayload,
} from "./historyAroundTown/types";
import { getGoldStandardCompanion } from "./goldStandard/algalBloomArticle";
import {
  hasSubstance,
  isInternalScoreLabel,
  isPlaceholderCopy,
} from "./contentQuality";
import {
  selectEditorialContinuation,
} from "./editorialContinuation";
import { knowledgeCardsFromPacket } from "./knowledgeCards";

export type EditionIntelligence = {
  discovery: DiscoveryPayload | null;
  knowledge: KnowledgePayload | null;
  memory: MemoryPayload | null;
  morning: MorningEditionPayload | null;
  morningOpening: MorningBriefing | null;
  morningBriefing: MorningBriefing | null;
  /** Daily public-domain hero artwork + About Today's Artwork paragraph. */
  morningHero: MorningHeroExperience | null;
  banditAside: string | null;
  /** Quiet continuity line from Memory — not a new section. */
  memoryNote: string | null;
  discoveryItems: RankedDiscoveryItem[];
  discoveryHeadline: string;
  discoveryEditorNote: string | null;
  leadWhyThisMatters: string | null;
  leadWhyChosen: string | null;
  /** Newspaper continuity slug when today’s Lead continues prior coverage. */
  leadContinuityKicker: string | null;
  /** Bandit’s single end-of-edition recommendation. */
  banditsPick: BanditsPick | null;
  /** Frozen History Around Town directory — read-only at runtime. */
  historyAroundTown: HistoryAroundTownEditionPayload | null;
  /** Deterministic forecast summary when stored on the edition row. */
  weatherSummary: string | null;
};

export type ParseEditionIntelligenceOptions = {
  /** Skip knowledge + memory JSON parse on the critical path; enrich in background. */
  deferKnowledgeMemory?: boolean;
};

export function parseEditionIntelligence(
  row: {
    bandit?: unknown;
    discovery?: unknown;
    knowledge?: unknown;
    memory?: unknown;
    morning_edition?: unknown;
    history_around_town?: unknown;
    editorial_context?: unknown;
    leadStory?: LeadStory | null;
  },
  options?: ParseEditionIntelligenceOptions
): EditionIntelligence {
  const discovery = parseDiscoveryPayload(row.discovery);
  const knowledge = options?.deferKnowledgeMemory
    ? null
    : parseKnowledgePayload(row.knowledge);
  const memory = options?.deferKnowledgeMemory
    ? null
    : parseMemoryPayload(row.memory);
  const morning = parseMorningEditionPayload(row.morning_edition);
  const bandit = parseBanditPayload(row.bandit);

  const morningOpening = requestMorningBriefing(
    { morning_edition: row.morning_edition },
    "opening_20s"
  );
  const morningBriefing = requestMorningBriefing(
    { morning_edition: row.morning_edition },
    "briefing_60s"
  );
  const morningHero = morningHeroFromEdition({ morning_edition: row.morning_edition });

  const weekly = banditWeeklyLine(bandit);
  const seasonal = banditSeasonalLine(bandit);
  const banditAside = weekly || seasonal || null;

  const since = memorySinceYouLastRead(memory);
  const memoryNote =
    since?.summary?.trim() ||
    (since?.title?.trim() ? since.title.trim() : null);

  // Prefer Bandit's Picks when enabled, then weekend ideas, then hidden gems.
  const pickSurfaces = (
    isBanditsPicksEnabled()
      ? (["bandits_picks", "weekend_ideas", "hidden_gems"] as const)
      : (["weekend_ideas", "hidden_gems"] as const)
  );
  let discoveryItems: RankedDiscoveryItem[] = [];
  let discoveryHeadline = "Worth your time";
  let discoveryEditorNote: string | null = null;

  for (const surface of pickSurfaces) {
    const items = discoveryItemsForSurface(discovery, surface);
    if (items.length) {
      discoveryItems = items.slice(0, 4);
      const result = discovery?.surfaces?.[surface];
      discoveryHeadline = result?.headline || labelForSurface(surface);
      discoveryEditorNote = result?.editorNote ?? null;
      break;
    }
  }

  // Fallback: flatten first few picks from any surface.
  if (!discoveryItems.length && discovery?.picks?.length) {
    const surfaces = Object.keys(discovery.surfaces ?? {}) as Array<
      keyof NonNullable<DiscoveryPayload["surfaces"]>
    >;
    for (const surface of surfaces) {
      const items = discoveryItemsForSurface(discovery, surface);
      if (items.length) {
        discoveryItems = items.slice(0, 4);
        discoveryHeadline =
          discovery.surfaces?.[surface]?.headline || "Quiet recommendations";
        discoveryEditorNote =
          discovery.surfaces?.[surface]?.editorNote ?? null;
        break;
      }
    }
  }

  const lead = row.leadStory ?? null;
  const packet = lead
    ? knowledge?.byStoryKey?.[lead.id] ?? null
    : null;
  const whyFacet = whyThisMatters(packet);
  const leadWhyThisMatters =
    whyFacet?.summary?.trim() ||
    morning?.beats?.leadWhy ||
    null;

  const leadContinuityKicker = continuityKickerForLead(memory, lead);
  const historyAroundTown = parseHistoryAroundTownPayload(row.history_around_town);

  return {
    discovery,
    knowledge,
    memory,
    morning,
    morningOpening,
    morningBriefing,
    morningHero,
    banditAside,
    memoryNote,
    discoveryItems,
    discoveryHeadline,
    discoveryEditorNote,
    leadWhyThisMatters,
    // LeadStorySection derives personalization reasons from lead.selection.
    leadWhyChosen: null,
    leadContinuityKicker,
    banditsPick: banditsPick(bandit),
    historyAroundTown,
    weatherSummary: extractWeatherSummaryFromEditorialContext(
      row.editorial_context
    ),
  };
}

/** Parse knowledge + memory after first paint — fills fields deferred at launch. */
export function enrichEditionIntelligenceKnowledgeMemory(
  base: EditionIntelligence,
  row: {
    knowledge?: unknown;
    memory?: unknown;
    leadStory?: LeadStory | null;
    morning_edition?: unknown;
  }
): EditionIntelligence {
  const knowledge = parseKnowledgePayload(row.knowledge);
  const memory = parseMemoryPayload(row.memory);
  const morning = parseMorningEditionPayload(row.morning_edition);
  const lead = row.leadStory ?? null;

  const since = memorySinceYouLastRead(memory);
  const memoryNote =
    since?.summary?.trim() ||
    (since?.title?.trim() ? since.title.trim() : null);

  const packet = lead ? knowledge?.byStoryKey?.[lead.id] ?? null : null;
  const whyFacet = whyThisMatters(packet);
  const leadWhyThisMatters =
    whyFacet?.summary?.trim() || morning?.beats?.leadWhy || null;

  return {
    ...base,
    knowledge,
    memory,
    memoryNote,
    leadWhyThisMatters,
    leadContinuityKicker: continuityKickerForLead(memory, lead),
  };
}

/**
 * Timeless newspaper tradition: mark serial coverage on the front page.
 * Digital feeds erased “Continued from yesterday”; Kindred keeps it when memory agrees.
 */
function continuityKickerForLead(
  memory: MemoryPayload | null,
  lead: LeadStory | null
): string | null {
  if (!memory || !lead?.id) return null;
  const threads = memoryForStory(memory, lead.id);
  const continues = threads.some(
    (t) => t.type === "continuing_news" || t.type === "ongoing_timeline"
  );
  if (!continues) return null;
  const daysAway = memory.sinceYouLastRead?.daysAway;
  if (daysAway === 1) return "Continued from yesterday";
  return "Continued from earlier editions";
}

function labelForSurface(surface: string): string {
  switch (surface) {
    case "bandits_picks":
      return "Worth your time";
    case "weekend_ideas":
      return "For the weekend";
    case "hidden_gems":
      return "Quiet finds";
    default:
      return "Worth your time";
  }
}

const KNOWLEDGE_NOTE_TYPES: KnowledgeFacetType[] = [
  "historical_background",
  "previous_coverage",
  "related_story",
  "trusted_explainer",
  "local_context",
  "definition",
  "timeline",
];

const KNOWLEDGE_KICKERS: Partial<Record<KnowledgeFacetType, string>> = {
  historical_background: "Background",
  previous_coverage: "Previously in Kindred",
  related_story: "Related",
  trusted_explainer: "Explainer",
  local_context: "Local context",
  definition: "In brief",
  timeline: "Timeline",
};

function knowledgeNotesFromPacket(
  packet: KnowledgePacket | null
): KnowledgeNote[] {
  if (!packet?.facets?.length) return [];
  const notes: KnowledgeNote[] = [];
  for (const type of KNOWLEDGE_NOTE_TYPES) {
    for (const facet of packet.facets) {
      if (facet.type !== type) continue;
      if (!hasSubstance(facet.summary, 16)) continue;
      if (isPlaceholderCopy(facet.title)) continue;
      notes.push({
        kicker: KNOWLEDGE_KICKERS[type] ?? "Context",
        title: facet.title?.trim() || KNOWLEDGE_KICKERS[type] || "Context",
        summary: facet.summary.trim(),
      });
      if (notes.length >= 4) return notes;
    }
  }
  return notes;
}

function buildCompanion(
  intelligence: EditionIntelligence,
  packet: KnowledgePacket | null,
  whyThisMattersNote: ArticleCompanion["whyThisMatters"],
  whyChosen: string | null,
  currentTitle?: string | null,
  storyId?: string | null
): ArticleCompanion {
  const why =
    whyThisMattersNote && hasSubstance(whyThisMattersNote.summary, 16)
      ? whyThisMattersNote
      : null;
  const chosen =
    whyChosen &&
    hasSubstance(whyChosen, 8) &&
    !isInternalScoreLabel(whyChosen)
      ? whyChosen
      : null;

  return {
    whyThisMatters: why,
    whyChosen: chosen,
    banditNote:
      chosen ||
      (why?.summary?.trim()
        ? why.summary.trim()
        : null),
    knowledgeNotes: knowledgeNotesFromPacket(packet),
    knowledgeCards: knowledgeCardsFromPacket(packet),
    continueReading: selectEditorialContinuation({
      packet,
      memory: intelligence.memory,
      storyId: storyId ?? null,
      currentTitle: currentTitle ?? null,
      currentArticleId: storyId ?? null,
      banditsPick: intelligence.banditsPick,
      terminal: false,
    }),
  };
}

/** Companion metadata for the article reader. */
export function companionForLead(
  intelligence: EditionIntelligence,
  lead: LeadStory
): ArticleCompanion {
  if (lead.role === "local") {
    const packet = intelligence.knowledge?.byStoryKey?.[lead.id] ?? null;
    return buildCompanion(
      intelligence,
      packet,
      null,
      intelligence.leadWhyThisMatters,
      lead.headline,
      lead.id
    );
  }
  // Phase 1 blueprint — gold-standard companion rides with the national Lead.
  return getGoldStandardCompanion();
}

/**
 * Build companion notes for any Kindred article from stored intelligence.
 * Lead articles get the richest packet; others look up by story id when present.
 */
export function companionForArticle(
  intelligence: EditionIntelligence | null | undefined,
  article: KindredArticle,
  leadStory?: LeadStory | null
): ArticleCompanion {
  if (!intelligence) {
    return {
      whyThisMatters: null,
      whyChosen: null,
      banditNote: null,
      knowledgeNotes: [],
      knowledgeCards: [],
      continueReading: selectEditorialContinuation({
        packet: null,
        terminal: false,
      }),
    };
  }

  if (leadStory && article.id === leadStory.id) {
    return companionForLead(intelligence, leadStory);
  }

  const packet = intelligence.knowledge?.byStoryKey?.[article.id] ?? null;
  const facet = whyThisMatters(packet);

  return buildCompanion(
    intelligence,
    packet,
    facet ? { title: facet.title, summary: facet.summary } : null,
    null,
    article.headline,
    article.id
  );
}
