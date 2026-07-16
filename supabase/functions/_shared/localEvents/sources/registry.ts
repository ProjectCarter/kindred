/**
 * Active connector registry — gather from every enabled trusted source.
 */

import type { LocalEvent, LocalEventLocation, LocalEventsFetchOptions } from "../provider.ts";
import { fetchSerpGoogleEventCandidates } from "../provider.ts";
import { fetchNpsParkEvents } from "./npsParkEvents.ts";
import { fetchEventbriteSearchCandidates } from "./eventbriteSearch.ts";
import { fetchTicketmasterSearchCandidates } from "./ticketmasterSearch.ts";
import { isEventbriteOnlyMode } from "../eventbriteOnlyMode.ts";
import type {
  LocalEventSourceConnector,
  LocalEventSourceId,
  SourceGatherResult,
} from "./types.ts";

const CONNECTORS: LocalEventSourceConnector[] = [
  {
    id: "nps_park_events",
    label: "National Park Service",
    tier: "official",
    trustScore: 98,
    fetch: fetchNpsParkEvents,
  },
  {
    id: "serp_google_events",
    label: "Google Events (via SerpAPI)",
    tier: "aggregator",
    trustScore: 62,
    fetch: fetchSerpGoogleEventCandidates,
  },
  {
    id: "eventbrite",
    label: "Eventbrite (via Google search)",
    tier: "aggregator",
    trustScore: 72,
    fetch: fetchEventbriteSearchCandidates,
  },
  {
    id: "ticketmaster",
    label: "Ticketmaster Discovery API",
    tier: "aggregator",
    trustScore: 70,
    fetch: fetchTicketmasterSearchCandidates,
  },
];

export function getActiveEventConnectors(
  options?: LocalEventsFetchOptions
): LocalEventSourceConnector[] {
  const eventbriteOnly = options?.eventbriteOnly ?? isEventbriteOnlyMode();
  if (eventbriteOnly) {
    return CONNECTORS.filter((c) => c.id === "eventbrite");
  }
  return CONNECTORS;
}

/** Gather from all active connectors in parallel; failures are isolated per source. */
export async function gatherFromAllSources(
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
): Promise<SourceGatherResult[]> {
  const connectors = getActiveEventConnectors(options);
  if ((options?.eventbriteOnly ?? isEventbriteOnlyMode()) && connectors.length === 1) {
    console.log("[localEvents:registry] EVENTBRITE_ONLY mode — other sources disabled");
  }
  const results = await Promise.all(
    connectors.map(async (connector): Promise<SourceGatherResult> => {
      try {
        const events = await connector.fetch(location, options);
        return { sourceId: connector.id, events };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[localEvents:${connector.id}] gather failed`, message);
        return { sourceId: connector.id, events: [], error: message };
      }
    })
  );
  return results;
}

export function connectorLabel(sourceId: LocalEventSourceId): string {
  return getActiveEventConnectors().find((c) => c.id === sourceId)?.label ?? sourceId;
}
