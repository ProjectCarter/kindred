/**
 * Active connector registry — gather from every enabled trusted source.
 */

import type { LocalEvent, LocalEventLocation, LocalEventsFetchOptions } from "../provider.ts";
import { fetchSerpGoogleEventCandidates } from "../provider.ts";
import { fetchNpsParkEvents } from "./npsParkEvents.ts";
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
];

export function getActiveEventConnectors(): LocalEventSourceConnector[] {
  return CONNECTORS;
}

/** Gather from all active connectors in parallel; failures are isolated per source. */
export async function gatherFromAllSources(
  location: LocalEventLocation,
  options?: LocalEventsFetchOptions
): Promise<SourceGatherResult[]> {
  const connectors = getActiveEventConnectors();
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
