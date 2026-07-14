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

  // Same edition — never overwrite a frozen discovery pool mid-read.
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
    return current;
  }

  const currentHasEvents = current.some((s) => s.section_type === "local_events");
  if (!currentHasEvents) {
    return [...current, incomingEvents];
  }

  const incomingParsed = incomingEvents.body
    ? parseLocalEventsBody(incomingEvents.body)
    : null;
  const currentParsed = currentEvents?.body
    ? parseLocalEventsBody(currentEvents.body)
    : null;

  if (!incomingParsed?.length && currentParsed?.length) {
    return current;
  }

  if (!incomingParsed?.length) {
    return current;
  }

  return current.map((section) =>
    section.section_type === "local_events" ? incomingEvents : section
  );
}
