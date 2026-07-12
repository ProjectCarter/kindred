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
import type { ArticleCompanion, ContinueReadingItem, KnowledgeNote } from "./articleCompanion";
import type { KindredArticle } from "./article";
import { isClippableSectionId } from "./article";
import {
  hasSubstance,
  isInternalScoreLabel,
  isPlaceholderCopy,
} from "./contentQuality";

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

const CONTINUE_LABEL: Partial<
  Record<KnowledgeFacetType, ContinueReadingItem["kind"]>
> = {
  related_story: "related",
  local_context: "local",
  historical_background: "background",
  trusted_explainer: "background",
  previous_coverage: "related",
};

const CONTINUE_DISPLAY: Record<ContinueReadingItem["kind"], string> = {
  related: "Related Story",
  local: "Local Perspective",
  background: "Background",
  opposing: "Opposing Viewpoint",
  bandit: "Bandit’s Pick",
};

function continueReadingFrom(
  intelligence: EditionIntelligence,
  packet: KnowledgePacket | null,
  currentTitle?: string | null
): ContinueReadingItem[] {
  const items: ContinueReadingItem[] = [];
  const seen = new Set<string>();
  const current = (currentTitle ?? "").trim().toLowerCase();

  if (packet?.facets) {
    for (const facet of packet.facets) {
      if (!hasSubstance(facet.summary, 18)) continue;
      const kind = CONTINUE_LABEL[facet.type];
      if (!kind) continue;
      const title = facet.title?.trim() || CONTINUE_DISPLAY[kind];
      if (current && title.toLowerCase() === current) continue;
      const key = `${kind}:${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        kind,
        label: CONTINUE_DISPLAY[kind],
        title,
        summary: facet.summary.trim().slice(0, 220),
      });
      if (items.length >= 3) break;
    }

    // Opposing viewpoint — only with a legitimate signal in real copy.
    if (!items.some((i) => i.kind === "opposing")) {
      const opposing = packet.facets.find(
        (f) =>
          hasSubstance(f.summary, 18) &&
          /another view|other side|critics|counterpoint|opposing view/i.test(
            `${f.title} ${f.summary}`
          )
      );
      if (opposing?.summary) {
        items.push({
          kind: "opposing",
          label: CONTINUE_DISPLAY.opposing,
          title: opposing.title?.trim() || "Another view",
          summary: opposing.summary.trim().slice(0, 220),
        });
      }
    }
  }

  const bandit = intelligence.discoveryItems?.[0];
  if (
    bandit?.item?.title &&
    items.length < 4 &&
    hasSubstance(bandit.item.dek, 8) &&
    !isPlaceholderCopy(bandit.item.title) &&
    !isPlaceholderCopy(bandit.item.dek)
  ) {
    const title = bandit.item.title.trim();
    if (!current || title.toLowerCase() !== current) {
      items.push({
        kind: "bandit",
        label: CONTINUE_DISPLAY.bandit,
        title,
        summary: bandit.item.dek.trim().slice(0, 220),
      });
    }
  }

  return items.slice(0, 3);
}

function buildCompanion(
  intelligence: EditionIntelligence,
  packet: KnowledgePacket | null,
  whyThisMattersNote: ArticleCompanion["whyThisMatters"],
  whyChosen: string | null,
  currentTitle?: string | null
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
    knowledgeNotes: knowledgeNotesFromPacket(packet),
    continueReading: continueReadingFrom(intelligence, packet, currentTitle),
  };
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
        !isInternalScoreLabel(r.label) &&
        !/score|algorithm|boost|rank|weight/i.test(r.label) &&
        !/score|algorithm|boost|rank/i.test(r.code)
    )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((r) => r.label.replace(/\.$/, ""))
    .join(". ");

  return buildCompanion(
    intelligence,
    packet,
    facet
      ? { title: facet.title, summary: facet.summary }
      : intelligence.leadWhyThisMatters
        ? {
            title: "Why this matters",
            summary: intelligence.leadWhyThisMatters,
          }
        : null,
    chosen ? chosen + "." : null,
    lead.headline
  );
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
      knowledgeNotes: [],
      continueReading: [],
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
    article.headline
  );
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
