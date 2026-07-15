/**
 * Trusted source network — connector contracts for Local Events discovery.
 * Connectors register here; the editorial pipeline gathers, merges, and ranks.
 */

import type { LocalEvent, LocalEventLocation, LocalEventsFetchOptions } from "../provider.ts";

export type LocalEventSourceTier =
  | "official"
  | "venue"
  | "aggregator";

export type LocalEventSourceId =
  | "serp_google_events"
  | "nps_park_events"
  | "city_calendar"
  | "parks_recreation"
  | "public_library"
  | "museum"
  | "tourism_bureau"
  | "university"
  | "eventbrite"
  | "ticketmaster"
  | "axs"
  | "fever"
  | "venue_website";

/** Metadata for sources in the trusted network (active or planned). */
export type TrustedEventSource = {
  id: LocalEventSourceId;
  label: string;
  tier: LocalEventSourceTier;
  /** Higher wins when duplicate listings disagree. */
  trustScore: number;
  /** Whether a connector is wired today. */
  active: boolean;
};

export const TRUSTED_EVENT_SOURCE_NETWORK: TrustedEventSource[] = [
  { id: "nps_park_events", label: "National Park Service", tier: "official", trustScore: 98, active: true },
  { id: "city_calendar", label: "City event calendars", tier: "official", trustScore: 95, active: false },
  { id: "parks_recreation", label: "Parks & Recreation", tier: "official", trustScore: 94, active: false },
  { id: "public_library", label: "Public libraries", tier: "official", trustScore: 93, active: false },
  { id: "museum", label: "Museums", tier: "official", trustScore: 92, active: false },
  { id: "tourism_bureau", label: "Visitor & Tourism bureaus", tier: "official", trustScore: 91, active: false },
  { id: "university", label: "Universities & Colleges", tier: "official", trustScore: 90, active: false },
  { id: "venue_website", label: "Official venue websites", tier: "venue", trustScore: 88, active: false },
  { id: "eventbrite", label: "Eventbrite", tier: "aggregator", trustScore: 72, active: false },
  { id: "ticketmaster", label: "Ticketmaster", tier: "aggregator", trustScore: 70, active: false },
  { id: "axs", label: "AXS", tier: "aggregator", trustScore: 68, active: false },
  { id: "fever", label: "Fever", tier: "aggregator", trustScore: 65, active: false },
  { id: "serp_google_events", label: "Google Events (via SerpAPI)", tier: "aggregator", trustScore: 62, active: true },
];

export function trustScoreForSource(sourceId: LocalEventSourceId | string | undefined): number {
  const hit = TRUSTED_EVENT_SOURCE_NETWORK.find((s) => s.id === sourceId);
  return hit?.trustScore ?? 55;
}

export type LocalEventSourceConnector = {
  id: LocalEventSourceId;
  label: string;
  tier: LocalEventSourceTier;
  trustScore: number;
  fetch(
    location: LocalEventLocation,
    options?: LocalEventsFetchOptions
  ): Promise<LocalEvent[]>;
};

export type SourceGatherResult = {
  sourceId: LocalEventSourceId;
  events: LocalEvent[];
  error?: string | null;
};
