/**
 * Weather planning note — forecast-based guidance beneath the homepage weather block.
 */

import type { HomepageWeatherCondition } from "./conditionDisplay.ts";
import { composeWeatherGuidance } from "./weatherGuidance.ts";
import {
  isLiveWeatherFresh,
  liveWeatherToSnapshot,
  type LiveWeatherResponse,
} from "./liveWeatherTypes.ts";
import type { KindredWeatherSnapshot } from "./weatherSnapshot.ts";

export type ResolveWeatherPlanningNoteInput = {
  weatherSummary?: string | null;
  weatherSectionHeadline?: string | null;
  weatherSectionBody?: string | null;
  morningWeatherBeat?: string | null;
  condition?: HomepageWeatherCondition | null;
  weatherSnapshot?: KindredWeatherSnapshot | null;
  liveWeather?: LiveWeatherResponse | null;
};

export function resolveWeatherPlanningNote(
  input: ResolveWeatherPlanningNoteInput
): string | null {
  const live = input.liveWeather;
  if (live && isLiveWeatherFresh(live)) {
    if (live.guidanceNote?.trim()) {
      return live.guidanceNote.trim();
    }
    return composeWeatherGuidance({
      snapshot: liveWeatherToSnapshot(live),
      parsed: null,
      persistedGuidance: null,
    });
  }

  const snapshot = input.weatherSnapshot ?? null;
  if (!snapshot) return null;

  return composeWeatherGuidance({
    snapshot,
    parsed: null,
    persistedGuidance: snapshot.guidanceNote ?? null,
  });
}
