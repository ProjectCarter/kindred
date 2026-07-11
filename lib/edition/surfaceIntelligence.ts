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

/** Companion metadata for the article reader. */
export function companionForLead(
  intelligence: EditionIntelligence,
  lead: LeadStory
): {
  whyThisMatters: { title: string; summary: string } | null;
  whyChosen: string | null;
} {
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
  };
}
