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
  | "botanical_garden"
  | "zoo_aquarium"
  | "university"
  | "farmers_market"
  | "state_park"
  | "community_center"
  | "fairground"
  | "performing_arts"
  | "concert_venue"
  | "sports_team"
  | "convention_center"
  | "local_festival"
  | "restaurant_week"
  | "cultural_org"
  | "chamber_commerce"
  | "business_improvement_district"
  | "shopping_center"
  | "historic_district"
  | "nonprofit"
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

/** Full trusted network — connectors activate over time. */
export const TRUSTED_EVENT_SOURCE_NETWORK: TrustedEventSource[] = [
  { id: "nps_park_events", label: "National Park Service", tier: "official", trustScore: 98, active: true },
  { id: "state_park", label: "State Parks", tier: "official", trustScore: 97, active: false },
  { id: "city_calendar", label: "City event calendars", tier: "official", trustScore: 95, active: false },
  { id: "parks_recreation", label: "Parks & Recreation", tier: "official", trustScore: 94, active: false },
  { id: "public_library", label: "Public libraries", tier: "official", trustScore: 93, active: false },
  { id: "museum", label: "Museums", tier: "official", trustScore: 92, active: false },
  { id: "botanical_garden", label: "Botanical gardens", tier: "official", trustScore: 92, active: false },
  { id: "zoo_aquarium", label: "Zoos & Aquariums", tier: "official", trustScore: 91, active: false },
  { id: "tourism_bureau", label: "Visitor & Tourism bureaus", tier: "official", trustScore: 91, active: false },
  { id: "university", label: "Universities & Colleges", tier: "official", trustScore: 90, active: false },
  { id: "farmers_market", label: "Farmers Markets", tier: "official", trustScore: 89, active: false },
  { id: "community_center", label: "Community centers", tier: "official", trustScore: 88, active: false },
  { id: "fairground", label: "Fairgrounds", tier: "official", trustScore: 88, active: false },
  { id: "performing_arts", label: "Performing arts venues", tier: "venue", trustScore: 87, active: false },
  { id: "concert_venue", label: "Concert venues", tier: "venue", trustScore: 86, active: false },
  { id: "sports_team", label: "Sports teams", tier: "venue", trustScore: 85, active: false },
  { id: "convention_center", label: "Convention centers", tier: "venue", trustScore: 84, active: false },
  { id: "local_festival", label: "Local festivals", tier: "official", trustScore: 84, active: false },
  { id: "restaurant_week", label: "Restaurant weeks", tier: "official", trustScore: 83, active: false },
  { id: "cultural_org", label: "Cultural organizations", tier: "official", trustScore: 82, active: false },
  { id: "chamber_commerce", label: "Chambers of Commerce", tier: "official", trustScore: 81, active: false },
  { id: "business_improvement_district", label: "Business Improvement Districts", tier: "official", trustScore: 80, active: false },
  { id: "shopping_center", label: "Major shopping centers", tier: "venue", trustScore: 78, active: false },
  { id: "historic_district", label: "Historic districts", tier: "official", trustScore: 77, active: false },
  { id: "nonprofit", label: "Local nonprofit organizations", tier: "official", trustScore: 76, active: false },
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
