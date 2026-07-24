/**
 * Final publication gate — last safety pass before edition persistence.
 * Re-runs family-safe filtering, schedule verification, editorial completeness,
 * and See All caps so unsafe or unpublishable items never reach status=ready.
 */

import type { DiscoveryItem, DiscoveryPayload, RankedDiscoveryItem } from "../discovery/types.ts";
import { eventHasPublishableEditorial } from "../localEvents/banditNotes.ts";
import {
  filterVerifiedEventsForEdition,
  type EventDateVerificationContext,
} from "../localEvents/eventDateVerification.ts";
import {
  filterFamilyFriendlyEvents,
  isEditoriallyExcludedListing,
} from "../localEvents/familyFriendlyFilter.ts";
import { filterNonBusinessEvents } from "../localEvents/businessEventFilter.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import {
  LOCAL_EVENTS_EDITION_SURFACED_MAX,
  SEE_ALL_MAX_ITEMS,
} from "../editorial/publishing.ts";
import { meetsDiscoveryConfidenceGate } from "../editorial/confidencePayload.ts";

export type PublicationGateRejection = {
  name: string;
  reason:
    | "family_unsafe"
    | "business_professional"
    | "unverified_schedule"
    | "missing_editorial"
    | "discovery_excluded"
    | "discovery_low_confidence"
    | "see_all_cap";
};

export type LocalEventsGateReport = {
  input: number;
  kept: number;
  rejected: PublicationGateRejection[];
  byReason: Record<string, number>;
};

export type DiscoveryGateReport = {
  inputItems: number;
  keptItems: number;
  rejectedFamily: number;
  rejectedConfidence: number;
  cappedSurfaces: number;
};

function bumpReason(map: Record<string, number>, reason: string): void {
  map[reason] = (map[reason] ?? 0) + 1;
}

function discoveryListingHay(item: DiscoveryItem): string {
  return [
    item.title,
    item.dek,
    item.address,
    ...(item.venueCategories ?? []),
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
}

function isPublishableDiscoveryItem(item: DiscoveryItem): boolean {
  if (isEditoriallyExcludedListing(discoveryListingHay(item)).excluded) {
    return false;
  }
  return meetsDiscoveryConfidenceGate(item);
}

/** Re-run all local event gates immediately before persisting edition_sections. */
export function gateLocalEventsForPublication(
  events: LocalEvent[],
  context: EventDateVerificationContext
): { events: LocalEvent[]; report: LocalEventsGateReport } {
  const rejected: PublicationGateRejection[] = [];
  const byReason: Record<string, number> = {};

  const family = filterFamilyFriendlyEvents(events);
  for (const sample of family.samples) {
    rejected.push({
      name: sample.name,
      reason: "family_unsafe",
    });
    bumpReason(byReason, "family_unsafe");
  }

  const business = filterNonBusinessEvents(family.kept);
  for (const sample of business.samples) {
    rejected.push({
      name: sample.name,
      reason: "business_professional",
    });
    bumpReason(byReason, "business_professional");
  }

  const schedule = filterVerifiedEventsForEdition(business.kept, context);
  for (const row of schedule.rejected) {
    rejected.push({
      name: row.name.slice(0, 80),
      reason: "unverified_schedule",
    });
    bumpReason(byReason, "unverified_schedule");
  }

  const editorialReady: LocalEvent[] = [];
  for (const event of schedule.verified) {
    if (eventHasPublishableEditorial(event)) {
      editorialReady.push(event);
      continue;
    }
    rejected.push({
      name: event.name.slice(0, 80),
      reason: "missing_editorial",
    });
    bumpReason(byReason, "missing_editorial");
  }

  const capped = editorialReady.slice(0, LOCAL_EVENTS_EDITION_SURFACED_MAX);
  if (editorialReady.length > capped.length) {
    for (const event of editorialReady.slice(capped.length)) {
      rejected.push({
        name: event.name.slice(0, 80),
        reason: "see_all_cap",
      });
      bumpReason(byReason, "see_all_cap");
    }
  }

  return {
    events: capped,
    report: {
      input: events.length,
      kept: capped.length,
      rejected: rejected.slice(0, 24),
      byReason,
    },
  };
}

function filterRankedDiscoveryItems(
  items: RankedDiscoveryItem[]
): { kept: RankedDiscoveryItem[]; rejectedFamily: number; rejectedConfidence: number } {
  let rejectedFamily = 0;
  let rejectedConfidence = 0;
  const kept: RankedDiscoveryItem[] = [];

  for (const row of items) {
    if (isEditoriallyExcludedListing(discoveryListingHay(row.item)).excluded) {
      rejectedFamily += 1;
      continue;
    }
    if (!meetsDiscoveryConfidenceGate(row.item)) {
      rejectedConfidence += 1;
      continue;
    }
    kept.push(row);
  }

  return { kept, rejectedFamily, rejectedConfidence };
}

/** Family-safe + confidence gate + per-surface See All cap on discovery payload. */
export function gateDiscoveryPayloadForPublication(
  payload: DiscoveryPayload
): { payload: DiscoveryPayload; report: DiscoveryGateReport } {
  let inputItems = 0;
  let keptItems = 0;
  let rejectedFamily = 0;
  let rejectedConfidence = 0;
  let cappedSurfaces = 0;

  const surfaces: DiscoveryPayload["surfaces"] = {};
  for (const [key, surface] of Object.entries(payload.surfaces)) {
    if (!surface?.items?.length) continue;
    inputItems += surface.items.length;

    const filtered = filterRankedDiscoveryItems(surface.items);
    rejectedFamily += filtered.rejectedFamily;
    rejectedConfidence += filtered.rejectedConfidence;

    const sorted = [...filtered.kept].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const capped = sorted.slice(0, SEE_ALL_MAX_ITEMS);
    if (sorted.length > capped.length) cappedSurfaces += 1;
    keptItems += capped.length;

    if (!capped.length) continue;
    surfaces[key as keyof typeof surfaces] = { ...surface, items: capped };
  }

  const picks: DiscoveryPayload["picks"] = [];
  const seen = new Set<string>();
  for (const result of Object.values(surfaces)) {
    if (!result) continue;
    for (const item of result.items) {
      if (seen.has(item.item.id)) continue;
      seen.add(item.item.id);
      picks.push({
        id: item.item.id,
        title: item.item.title,
        category: item.item.category,
        surface: result.surface,
        why: payload.picks.find((p) => p.id === item.item.id)?.why ?? "",
      });
    }
  }

  const enrichQueue =
    payload.selectionMeta.enrichQueue?.filter((item) =>
      isPublishableDiscoveryItem(item)
    ) ?? [];

  return {
    payload: {
      ...payload,
      surfaces,
      picks,
      selectionMeta: {
        ...payload.selectionMeta,
        enrichQueue,
        selectedCount: keptItems,
      },
    },
    report: {
      inputItems,
      keptItems,
      rejectedFamily,
      rejectedConfidence,
      cappedSurfaces,
    },
  };
}

export function logFinalPublicationGate(report: {
  traceId?: string | null;
  metroKey?: string | null;
  localEvents?: LocalEventsGateReport;
  discovery?: DiscoveryGateReport;
}): void {
  console.log(
    JSON.stringify({
      kind: "final_publication_gate",
      traceId: report.traceId ?? null,
      metroKey: report.metroKey ?? null,
      localEvents: report.localEvents ?? null,
      discovery: report.discovery ?? null,
    })
  );
}
