import type { ActiveLocation, KindredPlace } from "../location/types";
import { resolveActivePlace } from "../location/kindredLocation";
import { localEditionDate } from "../edition/dates";
import { liveHomeEditionDate } from "../edition/editionDateGuard";
import { isDeveloperMode } from "../dev/developerMode";
import {
  getDevEditionOverrideStateSync,
  hydrateDevEditionOverrideState,
  resolveDevEditionDate,
} from "../dev/editionOverrideStore";
import { getDevHistoryEntry } from "../dev/editionOverrideStore";

export async function resolveEffectiveEditionDate(now = new Date()): Promise<string> {
  const calendarToday = localEditionDate(now);
  if (!isDeveloperMode()) return calendarToday;
  await hydrateDevEditionOverrideState();
  const state = getDevEditionOverrideStateSync();
  if (state.activePreviewId) {
    const preview = getDevHistoryEntry(state.activePreviewId);
    if (preview) return liveHomeEditionDate(preview.editionDate, calendarToday);
  }
  if (state.override.enabled) {
    return liveHomeEditionDate(resolveDevEditionDate(state.override, now), calendarToday);
  }
  return calendarToday;
}

export function resolveEffectiveEditionDateSync(now = new Date()): string {
  const calendarToday = localEditionDate(now);
  if (!isDeveloperMode()) return calendarToday;
  const state = getDevEditionOverrideStateSync();
  if (state.activePreviewId) {
    const preview = getDevHistoryEntry(state.activePreviewId);
    if (preview) return liveHomeEditionDate(preview.editionDate, calendarToday);
  }
  if (state.override.enabled) {
    return liveHomeEditionDate(resolveDevEditionDate(state.override, now), calendarToday);
  }
  return calendarToday;
}

export async function resolveEffectivePlace(options?: {
  refreshIfStale?: boolean;
}): Promise<ActiveLocation> {
  if (!isDeveloperMode()) {
    return resolveActivePlace(options);
  }
  await hydrateDevEditionOverrideState();
  const state = getDevEditionOverrideStateSync();
  if (state.activePreviewId) {
    const preview = getDevHistoryEntry(state.activePreviewId);
    if (preview?.place) {
      return {
        place: preview.place,
        mode: "home",
        modeLabel: "Dev Preview",
        isTravel: false,
        needsSetup: false,
      };
    }
  }
  if (state.override.enabled && state.override.place) {
    return {
      place: state.override.place,
      mode: "home",
      modeLabel: "Dev Override",
      isTravel: false,
      needsSetup: false,
    };
  }
  return resolveActivePlace(options);
}

export function isDevEditionOverrideActive(): boolean {
  if (!isDeveloperMode()) return false;
  const state = getDevEditionOverrideStateSync();
  return Boolean(state.override.enabled && state.override.place);
}

export function isDevEditionPreviewActive(): boolean {
  if (!isDeveloperMode()) return false;
  return Boolean(getDevEditionOverrideStateSync().activePreviewId);
}

export function shouldBypassEditionCityMismatch(): boolean {
  // Only frozen historical previews may bypass — never live dev override generation.
  return isDevEditionPreviewActive();
}

export function getDevActivePreviewEntry() {
  if (!isDeveloperMode()) return null;
  const id = getDevEditionOverrideStateSync().activePreviewId;
  return getDevHistoryEntry(id);
}

export function getDevOverridePlace(): KindredPlace | null {
  if (!isDeveloperMode()) return null;
  const state = getDevEditionOverrideStateSync();
  if (state.override.enabled) return state.override.place;
  return null;
}
