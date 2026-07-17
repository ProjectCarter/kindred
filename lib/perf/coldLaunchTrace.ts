/**
 * TEMP(Phase One perf): remove before release.
 *
 * Stage-by-stage cold-launch trace — pinpoints where each homepage desk
 * is lost between Supabase and first paint.
 */

import type { EditionSection } from "../edition/types";
import type { LeadStory } from "../edition/LeadStory";
import type { BanditPayload } from "../edition/bandit";
import { banditsPick } from "../edition/bandit";
import { parseDiscoveryPayload } from "../edition/discovery";
import type { EditionIntelligence } from "../edition/surfaceIntelligence";
import { allocateDiscoverySections } from "../edition/sectionAllocator";
import type { ReaderLocation } from "../edition/localDiscoveryScope";

export type DeskId =
  | "weather"
  | "local_events"
  | "activities"
  | "recommendations"
  | "story_of"
  | "bandits_pick"
  | "today_in_history"
  | "local_news"
  | "morning_hero";

export type DeskTraceStage =
  | "supabase_editions_row"
  | "supabase_edition_sections"
  | "parse_discovery"
  | "parse_intelligence"
  | "react_state"
  | "render_gate";

export type DeskTrace = {
  desk: DeskId;
  stage: DeskTraceStage;
  present: boolean;
  detail?: Record<string, unknown>;
};

const TRACE_PREFIX = "[coldLaunch:trace]";

function surfaceCounts(discovery: ReturnType<typeof parseDiscoveryPayload>) {
  if (!discovery?.surfaces) return {};
  const counts: Record<string, number> = {};
  for (const [key, surface] of Object.entries(discovery.surfaces)) {
    counts[key] = surface?.items?.length ?? 0;
  }
  return counts;
}

export function traceSupabaseEditionRow(edition: {
  id?: string;
  edition_date?: string;
  status?: string;
  discovery?: unknown;
  lead_story?: unknown;
  bandit?: unknown;
  morning_edition?: unknown;
}): DeskTrace[] {
  const discovery = parseDiscoveryPayload(edition.discovery);
  const lead = edition.lead_story as LeadStory | null | undefined;
  const bandit = edition.bandit as BanditPayload | null | undefined;
  const morning = edition.morning_edition as {
    morningHero?: unknown;
  } | null;

  const traces: DeskTrace[] = [
    {
      desk: "weather",
      stage: "supabase_editions_row",
      present: true,
      detail: { note: "weather section lives in edition_sections, not editions row" },
    },
    {
      desk: "local_events",
      stage: "supabase_editions_row",
      present: true,
      detail: { note: "local_events section lives in edition_sections" },
    },
    {
      desk: "activities",
      stage: "supabase_editions_row",
      present: Boolean(discovery && Object.keys(discovery.surfaces ?? {}).some(
        (k) => (discovery.surfaces as Record<string, { items?: unknown[] }>)[k]?.items?.length
      )),
      detail: {
        discoveryParsed: Boolean(discovery),
        discoveryVersion: discovery?.version ?? null,
        surfaceCounts: surfaceCounts(discovery),
        pickCount: discovery?.picks?.length ?? 0,
      },
    },
    {
      desk: "recommendations",
      stage: "supabase_editions_row",
      present: Boolean(discovery && Object.keys(discovery.surfaces ?? {}).some(
        (k) => (discovery.surfaces as Record<string, { items?: unknown[] }>)[k]?.items?.length
      )),
      detail: { surfaceCounts: surfaceCounts(discovery) },
    },
    {
      desk: "bandits_pick",
      stage: "supabase_editions_row",
      present: Boolean(banditsPick(bandit ?? null)),
      detail: { hasBanditColumn: Boolean(edition.bandit) },
    },
    {
      desk: "today_in_history",
      stage: "supabase_editions_row",
      present: false,
      detail: { note: "today_in_history lives in edition_sections" },
    },
    {
      desk: "story_of",
      stage: "supabase_editions_row",
      present: false,
      detail: { note: "story_of lives in edition_sections" },
    },
    {
      desk: "local_news",
      stage: "supabase_editions_row",
      present: Boolean(lead?.headline?.trim()),
      detail: { role: lead?.role ?? null },
    },
    {
      desk: "morning_hero",
      stage: "supabase_editions_row",
      present: Boolean(morning?.morningHero),
      detail: { hasMorningEdition: Boolean(edition.morning_edition) },
    },
  ];

  logDeskTraces("supabase_editions_row", traces, {
    editionId: edition.id ?? null,
    editionDate: edition.edition_date ?? null,
    status: edition.status ?? null,
  });
  return traces;
}

export function traceSupabaseEditionSections(
  sections: EditionSection[]
): DeskTrace[] {
  const types = sections.map((s) => s.section_type);
  const traces: DeskTrace[] = [
    {
      desk: "weather",
      stage: "supabase_edition_sections",
      present: types.includes("weather"),
      detail: { sectionCount: sections.length, sectionTypes: types },
    },
    {
      desk: "local_events",
      stage: "supabase_edition_sections",
      present: types.includes("local_events"),
      detail: {
        bodyLength:
          sections.find((s) => s.section_type === "local_events")?.body
            ?.length ?? 0,
      },
    },
    {
      desk: "today_in_history",
      stage: "supabase_edition_sections",
      present: types.includes("today_in_history"),
      detail: {
        headline:
          sections.find((s) => s.section_type === "today_in_history")
            ?.headline ?? null,
      },
    },
    {
      desk: "story_of",
      stage: "supabase_edition_sections",
      present:
        types.includes("story_of") || types.includes("your_city"),
      detail: {
        headline:
          sections.find(
            (s) =>
              s.section_type === "story_of" || s.section_type === "your_city"
          )?.headline ?? null,
      },
    },
    {
      desk: "activities",
      stage: "supabase_edition_sections",
      present: false,
      detail: { note: "activities come from editions.discovery, not sections" },
    },
    {
      desk: "recommendations",
      stage: "supabase_edition_sections",
      present: false,
      detail: { note: "recommendations come from editions.discovery" },
    },
    {
      desk: "bandits_pick",
      stage: "supabase_edition_sections",
      present: false,
      detail: { note: "bandits_pick comes from editions.bandit" },
    },
    {
      desk: "local_news",
      stage: "supabase_edition_sections",
      present: types.includes("top_stories"),
      detail: { note: "lead also comes from editions.lead_story" },
    },
    {
      desk: "morning_hero",
      stage: "supabase_edition_sections",
      present: false,
      detail: { note: "morning_hero comes from editions.morning_edition" },
    },
  ];

  logDeskTraces("supabase_edition_sections", traces, {
    sectionCount: sections.length,
    sectionTypes: types,
  });
  return traces;
}

export function traceParsedIntelligence(
  intelligence: EditionIntelligence | null,
  leadStory: LeadStory | null,
  bandit: BanditPayload | null,
  readerLocation: ReaderLocation | null
): DeskTrace[] {
  const discovery = intelligence?.discovery ?? null;
  const allocation = allocateDiscoverySections(
    discovery,
    intelligence?.discoveryItems,
    { max: Infinity, readerLocation }
  );

  const traces: DeskTrace[] = [
    {
      desk: "activities",
      stage: "parse_intelligence",
      present: allocation.activities.length > 0,
      detail: {
        discoveryParsed: Boolean(discovery),
        surfaceCounts: surfaceCounts(discovery),
        allocated: allocation.activities.length,
      },
    },
    {
      desk: "recommendations",
      stage: "parse_intelligence",
      present: allocation.recommendations.length > 0,
      detail: { allocated: allocation.recommendations.length },
    },
    {
      desk: "bandits_pick",
      stage: "parse_intelligence",
      present: Boolean(banditsPick(bandit)),
    },
    {
      desk: "local_news",
      stage: "parse_intelligence",
      present: Boolean(leadStory?.headline?.trim()),
      detail: { role: leadStory?.role ?? null },
    },
    {
      desk: "morning_hero",
      stage: "parse_intelligence",
      present: Boolean(intelligence?.morningHero),
    },
  ];

  logDeskTraces("parse_intelligence", traces);
  return traces;
}

export function traceReactState(input: {
  sections: EditionSection[];
  intelligence: EditionIntelligence | null;
  leadStory: LeadStory | null;
  bandit: BanditPayload | null;
  readerLocation: ReaderLocation | null;
  applyPath: "full" | "syncAfterCache" | "patchEventsOnly";
}): DeskTrace[] {
  const types = input.sections.map((s) => s.section_type);
  const allocation = allocateDiscoverySections(
    input.intelligence?.discovery ?? null,
    input.intelligence?.discoveryItems,
    { max: Infinity, readerLocation: input.readerLocation }
  );

  const traces: DeskTrace[] = [
    {
      desk: "weather",
      stage: "react_state",
      present: types.includes("weather"),
      detail: { applyPath: input.applyPath, sectionTypes: types },
    },
    {
      desk: "local_events",
      stage: "react_state",
      present: types.includes("local_events"),
    },
    {
      desk: "today_in_history",
      stage: "react_state",
      present: types.includes("today_in_history"),
    },
    {
      desk: "story_of",
      stage: "react_state",
      present: types.includes("story_of") || types.includes("your_city"),
    },
    {
      desk: "activities",
      stage: "react_state",
      present: allocation.activities.length > 0,
      detail: { allocated: allocation.activities.length },
    },
    {
      desk: "recommendations",
      stage: "react_state",
      present: allocation.recommendations.length > 0,
      detail: { allocated: allocation.recommendations.length },
    },
    {
      desk: "bandits_pick",
      stage: "react_state",
      present: Boolean(banditsPick(input.bandit)),
    },
    {
      desk: "local_news",
      stage: "react_state",
      present: Boolean(input.leadStory?.headline?.trim()),
    },
    {
      desk: "morning_hero",
      stage: "react_state",
      present: Boolean(input.intelligence?.morningHero),
    },
  ];

  logDeskTraces("react_state", traces, { applyPath: input.applyPath });
  return traces;
}

export function traceEditionReaderRender(input: {
  sections: EditionSection[];
  discovery: EditionIntelligence["discovery"];
  discoveryItems: EditionIntelligence["discoveryItems"];
  banditsPickPresent: boolean;
  storyOfPresent: boolean;
  leadStory: LeadStory | null;
  morningHeroPresent: boolean;
  readerLocation: ReaderLocation | null;
}): void {
  const types = input.sections.map((s) => s.section_type);
  const allocation = allocateDiscoverySections(
    input.discovery,
    input.discoveryItems,
    { max: Infinity, readerLocation: input.readerLocation }
  );

  const historyInSections = types.includes("today_in_history");
  const storyOfInSections =
    types.includes("story_of") || types.includes("your_city");
  const weatherInSections = types.includes("weather");
  const localEventsInSections = types.includes("local_events");
  const activitiesRender = allocation.activities.length > 0;
  const recommendationsRender = allocation.recommendations.length > 0;
  const localNewsRender = Boolean(
    input.leadStory?.headline?.trim() && /local/i.test(input.leadStory.role ?? "")
  );

  const traces: DeskTrace[] = [
    {
      desk: "weather",
      stage: "render_gate",
      present: weatherInSections,
      detail: { skipReason: weatherInSections ? null : "no weather section in props.sections" },
    },
    {
      desk: "local_events",
      stage: "render_gate",
      present: localEventsInSections,
      detail: { skipReason: localEventsInSections ? null : "no local_events in props.sections" },
    },
    {
      desk: "activities",
      stage: "render_gate",
      present: activitiesRender,
      detail: {
        skipReason: activitiesRender
          ? null
          : "ActivitiesSection returns null when allocate/select yields 0 cards",
        poolSize: allocation.activities.length,
        discoverySurfaces: surfaceCounts(input.discovery),
      },
    },
    {
      desk: "recommendations",
      stage: "render_gate",
      present: recommendationsRender,
      detail: {
        skipReason: recommendationsRender
          ? null
          : "RecommendationsSection returns null when pool empty",
        poolSize: allocation.recommendations.length,
      },
    },
    {
      desk: "story_of",
      stage: "render_gate",
      present: input.storyOfPresent && storyOfInSections,
      detail: {
        skipReason:
          input.storyOfPresent && storyOfInSections
            ? null
            : storyOfInSections
              ? "StoryOfSection not mounted"
              : "EditionReader only renders History of Your City when story_of section exists",
      },
    },
    {
      desk: "bandits_pick",
      stage: "render_gate",
      present: input.banditsPickPresent,
      detail: {
        skipReason: input.banditsPickPresent ? null : "no banditsPick prop",
      },
    },
    {
      desk: "today_in_history",
      stage: "render_gate",
      present: historyInSections,
      detail: {
        skipReason: historyInSections
          ? null
          : "EditionReader only renders history when section row exists in props.sections",
      },
    },
    {
      desk: "local_news",
      stage: "render_gate",
      present: localNewsRender,
      detail: {
        skipReason: localNewsRender
          ? null
          : "TimeStylePackage local block needs leadStory with local role",
        leadRole: input.leadStory?.role ?? null,
      },
    },
    {
      desk: "morning_hero",
      stage: "render_gate",
      present: input.morningHeroPresent,
      detail: {
        skipReason: input.morningHeroPresent
          ? null
          : "MorningArrival morningHero prop missing",
      },
    },
  ];

  logDeskTraces("render_gate", traces);
}

function logDeskTraces(
  stage: DeskTraceStage,
  traces: DeskTrace[],
  meta?: Record<string, unknown>
): void {
  const missing = traces.filter((t) => !t.present).map((t) => t.desk);
  const payload = {
    stage,
    missing,
    desks: traces.map((t) => ({
      desk: t.desk,
      present: t.present,
      ...(t.detail ?? {}),
    })),
    ...meta,
  };
  if (missing.length > 0) {
    console.warn(`${TRACE_PREFIX} ${stage} — desks missing`, payload);
  } else {
    console.log(`${TRACE_PREFIX} ${stage} — all desks present`, payload);
  }
}

/** True when Supabase returned a ready row that is not a readable newspaper. */
export function isPersistedEditionComplete(
  edition: { discovery?: unknown; lead_story?: unknown; bandit?: unknown; morning_edition?: unknown },
  sections: EditionSection[],
  options?: { expectStoryOf?: boolean }
): { complete: boolean; reasons: string[] } {
  const types = sections.map((s) => s.section_type);
  const discovery = parseDiscoveryPayload(edition.discovery);
  const counts = surfaceCounts(discovery);
  const hasDiscoveryItems = Object.values(counts).some((n) => n > 0);
  const allocation = allocateDiscoverySections(discovery, null, { max: Infinity });
  const hasStoryOf = types.includes("story_of") || types.includes("your_city");

  const reasons: string[] = [];
  if (!types.includes("today_in_history")) {
    reasons.push("edition_sections missing today_in_history");
  }
  if (options?.expectStoryOf && !hasStoryOf) {
    reasons.push("edition_sections missing story_of");
  }
  if (!hasDiscoveryItems) {
    reasons.push("editions.discovery has zero surfaced items");
  }
  const hasLocalEventsSection = types.includes("local_events");
  const catalogSectionsPending =
    !hasLocalEventsSection &&
    allocation.activities.length === 0 &&
    allocation.recommendations.length === 0;

  if (!catalogSectionsPending) {
    if (allocation.activities.length === 0) {
      reasons.push("discovery pool has zero activities after allocate");
    }
    if (allocation.recommendations.length === 0) {
      reasons.push("discovery pool has zero recommendations after allocate");
    }
  }
  if (!banditsPick(edition.bandit as BanditPayload | null)) {
    reasons.push("editions.bandit has no pick");
  }

  return { complete: reasons.length === 0, reasons };
}
