/**
 * Events catalog — normalization, fingerprinting, lifecycle, deduplication.
 */

import type { LocalEvent, LocalEventLocation } from "./provider.ts";
import { parseEventStartDate } from "./horizon.ts";

export type EventCatalogLifecycle =
  | "discovered"
  | "verified"
  | "upcoming"
  | "today"
  | "past"
  | "archived"
  | "rejected"
  | "duplicate";

export const EVENT_CATALOG_ACTIVE_LIFECYCLES: readonly EventCatalogLifecycle[] = [
  "verified",
  "upcoming",
  "today",
];

export type EventsCatalogRow = {
  id: string;
  metro_key: string;
  provider: string;
  provider_id: string;
  dedupe_key: string;
  name: string;
  editorial_title: string | null;
  venue: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  start_at: string | null;
  end_at: string | null;
  event_timezone: string | null;
  official_website: string | null;
  ticket_url: string | null;
  content_fingerprint: string;
  lifecycle: EventCatalogLifecycle;
  verification_status: string;
  verification_confidence: number;
  event_payload: LocalEvent;
  editorial_teaser: string | null;
  editorial_body: string[] | null;
  source_history: unknown[];
  image_source: string | null;
  image_license: string | null;
  duplicate_of: string | null;
  first_seen_at: string;
  last_verified_at: string;
  last_material_change_at: string | null;
};

export function metroKeyFromEventLocation(location: LocalEventLocation): string {
  const state = location.state?.trim() || location.region?.trim() || "";
  const raw = `${location.city.trim()}-${state}`.toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function eventDedupeKey(event: LocalEvent): string {
  const name = event.name.toLowerCase().trim();
  const venue = event.venue.toLowerCase().trim();
  const schedule = event.startDateTime.toLowerCase().trim();
  return `${name}__${venue}__${schedule}`;
}

export function extractEventProviderId(event: LocalEvent): string {
  const url = event.sourceUrl?.trim() ?? "";
  const sourceId = event.sourceId ?? "unknown";

  if (sourceId === "ticketmaster") {
    const match = url.match(/\/event\/([A-Za-z0-9]+)/i);
    if (match) return `tm:${match[1]}`;
  }
  if (sourceId === "eventbrite") {
    const match = url.match(/\/e\/[^/?]+-(\d+)/i) ?? url.match(/eventbrite\.com\/e\/(\d+)/i);
    if (match) return `eb:${match[1]}`;
  }
  if (sourceId === "nps_park_events") {
    const match = url.match(/\/([a-z0-9-]+)\/?$/i);
    if (match) return `nps:${match[1]}`;
  }

  const digest = eventDedupeKey(event);
  let hash = 0;
  for (let i = 0; i < digest.length; i += 1) {
    hash = (hash * 31 + digest.charCodeAt(i)) >>> 0;
  }
  return `${sourceId}:hash:${hash.toString(16)}`;
}

export function eventContentFingerprint(event: LocalEvent): string {
  const parts = [
    event.name,
    event.venue,
    event.startDateTime,
    event.endDateIso ?? "",
    event.startTimeIso ?? "",
    event.sourceUrl,
    event.officialWebsite ?? "",
    event.imageUrl ?? "",
    event.city,
  ];
  return parts.join("|").toLowerCase().replace(/\s+/g, " ").trim();
}

export function serializeEventPayload(event: LocalEvent): LocalEvent {
  const { badgeSignals: _badgeSignals, ...rest } = event as LocalEvent & {
    badgeSignals?: unknown;
  };
  return rest;
}

export function eventVerificationConfidence(event: LocalEvent): number {
  if (event.dateVerification?.verificationStatus === "verified") {
    if (event.dateSourceType === "official_ticketing_page") return 95;
    if (event.dateSourceType === "official_organizer_page") return 92;
    if (event.dateSourceType === "official_venue_calendar") return 90;
    return 82;
  }
  return 0;
}

export function resolveEventStartInstant(
  event: LocalEvent,
  location: LocalEventLocation,
  now: Date = new Date()
): Date | null {
  void location;
  return parseEventStartDate(
    event.startDateTime,
    event.startDateIso ?? null,
    now
  );
}

export function resolveEventCatalogLifecycle(
  event: LocalEvent,
  location: LocalEventLocation,
  now: Date,
  verified: boolean
): EventCatalogLifecycle {
  if (!verified) return "rejected";

  const confidence = eventVerificationConfidence(event);
  if (confidence < 70) return "discovered";

  const start = resolveEventStartInstant(event, location);
  if (!start) return "verified";

  const today = new Date(now);
  const startDay = start.toDateString();
  const todayDay = today.toDateString();

  if (start < now) {
    const endIso = event.endDateIso?.trim();
    if (endIso) {
      const end = new Date(endIso);
      if (!Number.isNaN(end.getTime()) && end < now) return "past";
    }
    if (startDay !== todayDay) return "past";
  }

  if (startDay === todayDay) return "today";
  return "upcoming";
}

export function findEventCatalogDuplicate(
  event: LocalEvent,
  rows: EventsCatalogRow[]
): EventsCatalogRow | null {
  const dedupeKey = eventDedupeKey(event);
  const exact = rows.find((row) => row.dedupe_key === dedupeKey);
  if (exact) return exact;

  const providerId = extractEventProviderId(event);
  const provider = event.sourceId ?? "unknown";
  const byProvider = rows.find(
    (row) => row.provider === provider && row.provider_id === providerId
  );
  return byProvider ?? null;
}

export function isEventCatalogActiveLifecycle(lifecycle: EventCatalogLifecycle): boolean {
  return EVENT_CATALOG_ACTIVE_LIFECYCLES.includes(lifecycle);
}

export function rowToLocalEvent(row: EventsCatalogRow): LocalEvent {
  const payload = row.event_payload;
  return {
    ...payload,
    banditNote: payload.banditNote ?? row.editorial_teaser ?? null,
    editorialBody: payload.editorialBody ?? row.editorial_body ?? null,
  };
}
