/**
 * Local Events recovery — when today's edition has zero events (often from a
 * transient API failure cached by the freeze layer), attempt an events-only
 * refresh without reshuffling the rest of the printed paper.
 */

import { supabase } from "../supabase";
import { locationPayload, type KindredPlace } from "../location/deviceLocation";
import type { EditionSection } from "./types";
import { loadWithRetry } from "./loadWithRetry";
import {
  countValidEventsInSections,
  logLocalEventsPipeline,
  logLocalEventsRequest,
  pipelineCountsFromSections,
} from "./localEventsPipeline";
import { mergeEventsSectionIntoSections } from "./editionFreeze";
import {
  saveCachedEdition,
  type CachedEditionBundle,
} from "./editionCache";

const RECOVERY_THROTTLE_MS = 60_000;
const lastRecoveryAt = new Map<string, number>();

export type LocalEventsRecoveryResult = {
  attempted: boolean;
  recovered: boolean;
  eventCount: number;
  mergedSections: EditionSection[];
  error?: string | null;
};

function recoveryKey(editionId: string, editionDate: string): string {
  return `${editionId}:${editionDate}`;
}

function canAttemptRecovery(editionId: string, editionDate: string): boolean {
  const key = recoveryKey(editionId, editionDate);
  const last = lastRecoveryAt.get(key) ?? 0;
  return Date.now() - last >= RECOVERY_THROTTLE_MS;
}

function markRecoveryAttempt(editionId: string, editionDate: string): void {
  lastRecoveryAt.set(recoveryKey(editionId, editionDate), Date.now());
}

async function fetchLocalEventsSection(
  editionId: string
): Promise<EditionSection | null> {
  const { data, error } = await supabase
    .from("edition_sections")
    .select("id, section_type, position, headline, body, source_note")
    .eq("edition_id", editionId)
    .eq("section_type", "local_events")
    .maybeSingle();

  if (error && __DEV__) {
    console.warn("[localEvents:recovery] section fetch error", {
      message: error.message,
      editionId,
    });
    return null;
  }

  return (data as EditionSection | null) ?? null;
}

/**
 * Invoke refresh-live-data, then read back only the local_events row.
 * Bypasses the normal 15-minute live-refresh throttle — zero events is an
 * emergency, not background upkeep.
 */
export async function recoverLocalEvents(params: {
  editionId: string;
  editionDate: string;
  place: KindredPlace;
  currentSections: EditionSection[];
  cachedBundle?: CachedEditionBundle | null;
}): Promise<LocalEventsRecoveryResult> {
  const { editionId, editionDate, place, currentSections, cachedBundle } =
    params;

  if (!canAttemptRecovery(editionId, editionDate)) {
    return {
      attempted: false,
      recovered: false,
      eventCount: countValidEventsInSections(currentSections),
      mergedSections: currentSections,
    };
  }

  markRecoveryAttempt(editionId, editionDate);

  logLocalEventsRequest({
    source: "recoverLocalEvents",
    city: place.city,
    region: place.region,
    state: place.state,
    lat: place.lat,
    lon: place.lon,
    editionDate,
    editionId,
    searchRadius: "provider_default (city query, East Valley inclusive)",
    dateRange: "htichips=date:week",
  });

  const invokeResult = await loadWithRetry(
    async () => {
      const { data, error } = await supabase.functions.invoke(
        "refresh-live-data",
        {
          body: {
            location: locationPayload(place),
            editionDate,
          },
        }
      );
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    { label: "recoverLocalEvents", maxAttempts: 3 }
  );

  if (!invokeResult.ok && __DEV__) {
    console.warn("[localEvents:recovery] refresh-live-data failed", {
      message: invokeResult.error.message,
      attempts: invokeResult.attempt,
    });
  }

  const sectionRow = await fetchLocalEventsSection(editionId);
  if (!sectionRow) {
    return {
      attempted: true,
      recovered: false,
      eventCount: countValidEventsInSections(currentSections),
      mergedSections: currentSections,
      error: invokeResult.ok ? "no_local_events_section" : invokeResult.error.message,
    };
  }

  const merged = mergeEventsSectionIntoSections(currentSections, sectionRow);
  const eventCount = countValidEventsInSections(merged);
  const recovered = eventCount > 0;

  logLocalEventsPipeline(
    "recovery complete",
    pipelineCountsFromSections(merged),
    {
      invokeOk: invokeResult.ok,
      recovered,
      invokeBody: invokeResult.ok ? invokeResult.value : null,
    }
  );

  if (recovered && cachedBundle) {
    void saveCachedEdition({
      ...cachedBundle,
      sections: merged,
      cachedAt: Date.now(),
    });
  }

  return {
    attempted: true,
    recovered,
    eventCount,
    mergedSections: merged,
    error: recovered ? null : "recovery_returned_zero_events",
  };
}

export function needsLocalEventsRecovery(sections: EditionSection[]): boolean {
  return countValidEventsInSections(sections) === 0;
}
