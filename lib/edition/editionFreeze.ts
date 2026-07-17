/**
 * Client-side edition freeze — once today's paper has been rendered, the
 * printed narrative (hero, greeting, section order, Activities,
 * Recommendations, Bandit's Pick, discovery pool) must not shift while the
 * reader is still on the same edition. Only structured event facts
 * (times, cancellations, venue updates) may patch through live refresh.
 */

import type { EditionSection } from "./types";
import type { DiscoveryPayload, RankedDiscoveryItem } from "./discovery";
import { parseLocalEventsBody } from "./localEvents";

export type FrozenEditionKey = {
  editionId: string;
  editionDate: string;
};

let frozenKey: FrozenEditionKey | null = null;

/** Discovery snapshot frozen at first render — Activities/Recommendations derive from this. */
let frozenDiscovery: DiscoveryPayload | null = null;
let frozenDiscoveryItems: RankedDiscoveryItem[] | null | undefined = null;

/** Hero image id frozen for this edition — MorningArrival reads this. */
let frozenHeroImageId: string | null = null;

export function isEditionFrozen(key: FrozenEditionKey): boolean {
  return (
    frozenKey?.editionId === key.editionId &&
    frozenKey?.editionDate === key.editionDate
  );
}

export function freezeEdition(params: {
  editionId: string;
  editionDate: string;
  discovery?: DiscoveryPayload | null;
  discoveryItems?: RankedDiscoveryItem[] | null;
  heroImageId?: string | null;
}): void {
  const same =
    frozenKey?.editionId === params.editionId &&
    frozenKey?.editionDate === params.editionDate;

  if (!same) {
    frozenKey = {
      editionId: params.editionId,
      editionDate: params.editionDate,
    };
    frozenDiscovery = params.discovery ?? null;
    frozenDiscoveryItems = params.discoveryItems ?? null;
    frozenHeroImageId = params.heroImageId ?? null;
    return;
  }

  // Same edition — never replace a populated discovery pool mid-read, but do
  // allow filling in when the first freeze raced ahead of the network payload
  // (null/empty → full). Otherwise Activities/Recommendations stay blank.
  if (frozenDiscovery == null && params.discovery) {
    frozenDiscovery = params.discovery;
  }
  if (
    (frozenDiscoveryItems == null || frozenDiscoveryItems.length === 0) &&
    params.discoveryItems &&
    params.discoveryItems.length > 0
  ) {
    frozenDiscoveryItems = params.discoveryItems;
  }
  if (frozenHeroImageId == null && params.heroImageId) {
    frozenHeroImageId = params.heroImageId;
  }
}

export function getFrozenDiscovery(): {
  discovery: DiscoveryPayload | null;
  discoveryItems: RankedDiscoveryItem[] | null | undefined;
} {
  return {
    discovery: frozenDiscovery,
    discoveryItems: frozenDiscoveryItems,
  };
}

export function getFrozenHeroImageId(): string | null {
  return frozenHeroImageId;
}

export function setFrozenHeroImageId(id: string | null): void {
  if (id) frozenHeroImageId = id;
}

export function clearEditionFreeze(): void {
  frozenKey = null;
  frozenDiscovery = null;
  frozenDiscoveryItems = null;
  frozenHeroImageId = null;
}

/**
 * When the same edition reloads from the network, only merge factual event
 * changes into the frozen sections — never drop Local Events, never reorder
 * the folio, never blank a section that was already printed.
 */
export function mergeEventsSectionIntoSections(
  current: EditionSection[],
  eventsSection: EditionSection
): EditionSection[] {
  return mergeFrozenSections(current, [eventsSection]);
}

const NARRATIVE_SECTION_TYPES = new Set([
  "story_of",
  "your_city",
  "today_in_history",
  "looking_ahead",
  "top_stories",
]);

function mergeNarrativeSectionsFromIncoming(
  current: EditionSection[],
  incoming: EditionSection[]
): EditionSection[] {
  let merged = [...current];
  for (const section of incoming) {
    if (!NARRATIVE_SECTION_TYPES.has(section.section_type)) continue;
    const alreadyPresent = merged.some(
      (s) => s.section_type === section.section_type
    );
    if (alreadyPresent) continue;
    merged = [...merged, section].sort((a, b) => a.position - b.position);
  }
  return merged;
}

export function mergeFrozenSections(
  current: EditionSection[],
  incoming: EditionSection[]
): EditionSection[] {
  if (!current.length) return incoming;

  const incomingEvents = incoming.find((s) => s.section_type === "local_events");
  const currentEvents = current.find((s) => s.section_type === "local_events");

  // Never silently remove Local Events — keep the printed section if the
  // fresh fetch didn't include one or returned an empty body.
  if (!incomingEvents) {
    return mergeNarrativeSectionsFromIncoming(current, incoming);
  }

  const currentHasEvents = current.some((s) => s.section_type === "local_events");
  const incomingParsed = incomingEvents.body
    ? parseLocalEventsBody(incomingEvents.body)
    : null;
  const currentParsed = currentEvents?.body
    ? parseLocalEventsBody(currentEvents.body)
    : null;

  const incomingCount = incomingParsed?.length ?? 0;
  const currentCount = currentParsed?.length ?? 0;

  if (__DEV__) {
    console.log("[editionFreeze] mergeFrozenSections", {
      currentHasEvents,
      currentCount,
      incomingCount,
      incomingParseFailed: Boolean(incomingEvents.body && incomingParsed === null),
    });
  }

  // First time events arrive — insert or replace even when parse is empty
  // but the section row exists (recovery path).
  if (!currentHasEvents) {
    return mergeNarrativeSectionsFromIncoming(
      [...current, incomingEvents],
      incoming
    );
  }

  // Keep printed events if the fresh fetch failed parse or returned empty.
  if (incomingParsed === null) {
    return mergeNarrativeSectionsFromIncoming(current, incoming);
  }

  if (incomingCount === 0 && currentCount > 0) {
    return mergeNarrativeSectionsFromIncoming(current, incoming);
  }

  if (incomingCount === 0) {
    // Both empty — still keep the section shell so the desk stays visible.
    return mergeNarrativeSectionsFromIncoming(
      current.map((section) =>
        section.section_type === "local_events" ? incomingEvents : section
      ),
      incoming
    );
  }

  const withEvents = current.map((section) =>
    section.section_type === "local_events" ? incomingEvents : section
  );
  return mergeNarrativeSectionsFromIncoming(withEvents, incoming);
}
