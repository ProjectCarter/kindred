/**
 * Derive user-visible newspaper surfaces from stored engine payloads.
 * Keeps screens thin — no new backend.
 */

import {
  banditSeasonalLine,
  banditWeeklyLine,
  parseBanditPayload,
} from "./bandit";
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
  type MemoryPayload,
} from "./memory";
import {
  parseMorningEditionPayload,
  requestMorningBriefing,
  type MorningBriefing,
  type MorningEditionPayload,
} from "./morningEdition";
import type { LeadStory } from "./LeadStory";
import type { ArticleCompanion, KnowledgeNote } from "./articleCompanion";
import type { KindredArticle } from "./article";
import { isClippableSectionId } from "./article";

export type EditionIntelligence = {
  discovery: DiscoveryPayload | null;
  knowledge: KnowledgePayload | null;
  memory: MemoryPayload | null;
  morning: MorningEditionPayload | null;
  morningOpening: MorningBriefing | null;
  morningBriefing: MorningBriefing | null;
  banditAside: string | null;
  /** Quiet continuity line from Memory — not a new section. */
  memoryNote: string | null;
  discoveryItems: RankedDiscoveryItem[];
  discoveryHeadline: string;
  discoveryEditorNote: string | null;
  leadWhyThisMatters: string | null;
  leadWhyChosen: string | null;
};

export function parseEditionIntelligence(row: {
  bandit?: unknown;
  discovery?: unknown;
  knowledge?: unknown;
  memory?: unknown;
  morning_edition?: unknown;
  leadStory?: LeadStory | null;
}): EditionIntelligence {
  const discovery = parseDiscoveryPayload(row.discovery);
  const knowledge = parseKnowledgePayload(row.knowledge);
  const memory = parseMemoryPayload(row.memory);
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

  const weekly = banditWeeklyLine(bandit);
  const seasonal = banditSeasonalLine(bandit);
  const banditAside = weekly || seasonal || null;

  const since = memorySinceYouLastRead(memory);
  const memoryNote =
    since?.summary?.trim() ||
    (since?.title?.trim() ? since.title.trim() : null);

  // Prefer Bandit's Picks, then weekend ideas, then hidden gems.
  const pickSurfaces = [
    "bandits_picks",
    "weekend_ideas",
    "hidden_gems",
  ] as const;
  let discoveryItems: RankedDiscoveryItem[] = [];
  let discoveryHeadline = "Bandit’s Picks";
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

  return {
    discovery,
    knowledge,
    memory,
    morning,
    morningOpening,
    morningBriefing,
    banditAside,
    memoryNote,
    discoveryItems,
    discoveryHeadline,
    discoveryEditorNote,
    leadWhyThisMatters,
    // LeadStorySection derives personalization reasons from lead.selection.
    leadWhyChosen: null,
  };
}

function labelForSurface(surface: string): string {
  switch (surface) {
    case "bandits_picks":
      return "Bandit’s Picks";
    case "weekend_ideas":
      return "Weekend Ideas";
    case "hidden_gems":
      return "Hidden Gems";
    default:
      return "Quiet recommendations";
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
      if (!facet.summary?.trim()) continue;
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

/** Companion metadata for the article reader. */
export function companionForLead(
  intelligence: EditionIntelligence,
  lead: LeadStory
): ArticleCompanion {
  const packet = intelligence.knowledge?.byStoryKey?.[lead.id] ?? null;
  const facet = whyThisMatters(packet);
  const reasons = lead.selection?.reasons ?? [];
  const chosen = reasons
    .filter(
      (r) =>
        r.weight > 0 &&
        !r.code.startsWith("role_") &&
        !/score|algorithm|boost|rank|weight/i.test(r.label) &&
        !/score|algorithm|boost|rank/i.test(r.code)
    )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((r) => r.label.replace(/\.$/, ""))
    .join(". ");

  return {
    whyThisMatters: facet
      ? { title: facet.title, summary: facet.summary }
      : intelligence.leadWhyThisMatters
        ? {
            title: "Why this matters",
            summary: intelligence.leadWhyThisMatters,
          }
        : null,
    whyChosen: chosen ? chosen + "." : null,
    knowledgeNotes: knowledgeNotesFromPacket(packet),
  };
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
    return { whyThisMatters: null, whyChosen: null, knowledgeNotes: [] };
  }

  if (leadStory && article.id === leadStory.id) {
    return companionForLead(intelligence, leadStory);
  }

  const packet =
    intelligence.knowledge?.byStoryKey?.[article.id] ?? null;
  const facet = whyThisMatters(packet);

  return {
    whyThisMatters: facet
      ? { title: facet.title, summary: facet.summary }
      : null,
    whyChosen: null,
    knowledgeNotes: knowledgeNotesFromPacket(packet),
  };
}

/** Section UUID when the article can be saved to Clippings. */
export function clipSectionIdForArticle(article: KindredArticle): string | null {
  if (
    article.section === "lead" ||
    article.section === "discovery" ||
    article.section === "knowledge"
  ) {
    return null;
  }
  return isClippableSectionId(article.id) ? article.id : null;
}
