import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KindredPlace } from "../location/types";
import { localEditionDate } from "../edition/dates";
import { assertDeveloperMode } from "./developerMode";
import { clearDeveloperPreviewContext } from "./developerPreviewContext";
import {
  DEFAULT_DEV_EDITION_OVERRIDE,
  DEFAULT_DEV_EDITION_OVERRIDE_STATE,
  type DevEditionHistoryEntry,
  type DevEditionOverride,
  type DevEditionOverrideState,
  type EditionDateMode,
} from "./editionOverrideTypes";

const STORAGE_KEY = "@kindred/dev/edition-override-v1";
const MAX_HISTORY = 24;
const MAX_RECENT = 12;
const MAX_FAVORITES = 24;

let memoryState: DevEditionOverrideState = DEFAULT_DEV_EDITION_OVERRIDE_STATE;
let hydrated = false;

function placeKey(place: KindredPlace): string {
  return `${place.city}|${place.lat.toFixed(4)}|${place.lon.toFixed(4)}`.toLowerCase();
}

function dedupePlaces(places: KindredPlace[]): KindredPlace[] {
  const seen = new Set<string>();
  const out: KindredPlace[] = [];
  for (const place of places) {
    const key = placeKey(place);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

function normalizeState(raw: unknown): DevEditionOverrideState {
  if (!raw || typeof raw !== "object") return DEFAULT_DEV_EDITION_OVERRIDE_STATE;
  const o = raw as Partial<DevEditionOverrideState>;
  const overrideRaw = o.override as Partial<DevEditionOverride> | undefined;
  return {
    override: {
      enabled: Boolean(overrideRaw?.enabled),
      place: overrideRaw?.place ?? null,
      dateMode:
        overrideRaw?.dateMode === "tomorrow" ||
        overrideRaw?.dateMode === "custom" ||
        overrideRaw?.dateMode === "today"
          ? overrideRaw.dateMode
          : "today",
      customEditionDate:
        typeof overrideRaw?.customEditionDate === "string"
          ? overrideRaw.customEditionDate
          : null,
    },
    favorites: Array.isArray(o.favorites) ? dedupePlaces(o.favorites).slice(0, MAX_FAVORITES) : [],
    recentPlaces: Array.isArray(o.recentPlaces)
      ? dedupePlaces(o.recentPlaces).slice(0, MAX_RECENT)
      : [],
    history: Array.isArray(o.history) ? o.history.slice(0, MAX_HISTORY) : [],
    compare: {
      slotAId: o.compare?.slotAId ?? null,
      slotBId: o.compare?.slotBId ?? null,
    },
    activePreviewId: o.activePreviewId ?? null,
  };
}

export function resolveDevEditionDate(
  override: DevEditionOverride,
  now = new Date()
): string {
  if (override.dateMode === "custom" && override.customEditionDate?.trim()) {
    return override.customEditionDate.trim();
  }
  if (override.dateMode === "tomorrow") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return localEditionDate(d);
  }
  return localEditionDate(now);
}

export async function hydrateDevEditionOverrideState(): Promise<DevEditionOverrideState> {
  if (!assertDeveloperMode("hydrateDevEditionOverrideState")) {
    memoryState = DEFAULT_DEV_EDITION_OVERRIDE_STATE;
    hydrated = true;
    return memoryState;
  }
  if (hydrated) return memoryState;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memoryState = raw ? normalizeState(JSON.parse(raw)) : DEFAULT_DEV_EDITION_OVERRIDE_STATE;
  } catch {
    memoryState = DEFAULT_DEV_EDITION_OVERRIDE_STATE;
  }
  hydrated = true;
  return memoryState;
}

export function getDevEditionOverrideStateSync(): DevEditionOverrideState {
  return memoryState;
}

async function persistState(state: DevEditionOverrideState): Promise<void> {
  if (!assertDeveloperMode("persistDevEditionOverrideState")) return;
  memoryState = state;
  hydrated = true;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function setDevEditionOverride(
  patch: Partial<DevEditionOverride>
): Promise<DevEditionOverrideState> {
  await hydrateDevEditionOverrideState();
  const next: DevEditionOverrideState = {
    ...memoryState,
    override: { ...memoryState.override, ...patch, enabled: true },
    activePreviewId: null,
  };
  await persistState(next);
  return next;
}

export async function disableDevEditionOverride(): Promise<void> {
  await hydrateDevEditionOverrideState();
  await clearDeveloperPreviewContext();
  await persistState({
    ...memoryState,
    override: { ...memoryState.override, enabled: false },
    activePreviewId: null,
  });
}

export async function touchDevRecentPlace(place: KindredPlace): Promise<void> {
  await hydrateDevEditionOverrideState();
  const recentPlaces = dedupePlaces([place, ...memoryState.recentPlaces]).slice(
    0,
    MAX_RECENT
  );
  await persistState({ ...memoryState, recentPlaces });
}

export async function toggleDevFavoritePlace(place: KindredPlace): Promise<boolean> {
  await hydrateDevEditionOverrideState();
  const key = placeKey(place);
  const exists = memoryState.favorites.some((f) => placeKey(f) === key);
  const favorites = exists
    ? memoryState.favorites.filter((f) => placeKey(f) !== key)
    : dedupePlaces([place, ...memoryState.favorites]).slice(0, MAX_FAVORITES);
  await persistState({ ...memoryState, favorites });
  return !exists;
}

export function isDevFavoritePlace(place: KindredPlace): boolean {
  const key = placeKey(place);
  return memoryState.favorites.some((f) => placeKey(f) === key);
}

export async function appendDevEditionHistory(
  entry: DevEditionHistoryEntry
): Promise<void> {
  await hydrateDevEditionOverrideState();
  const history = [
    entry,
    ...memoryState.history.filter((row) => row.id !== entry.id),
  ].slice(0, MAX_HISTORY);
  await persistState({ ...memoryState, history });
}

export async function setDevCompareSlot(
  slot: "A" | "B",
  historyId: string | null
): Promise<void> {
  await hydrateDevEditionOverrideState();
  const compare = { ...memoryState.compare };
  if (slot === "A") compare.slotAId = historyId;
  else compare.slotBId = historyId;
  await persistState({ ...memoryState, compare });
}

export async function setDevActivePreviewId(id: string | null): Promise<void> {
  await hydrateDevEditionOverrideState();
  await persistState({ ...memoryState, activePreviewId: id });
}

export function getDevHistoryEntry(id: string | null | undefined): DevEditionHistoryEntry | null {
  if (!id) return null;
  return memoryState.history.find((row) => row.id === id) ?? null;
}

export async function setDevEditionDateMode(
  dateMode: EditionDateMode,
  customEditionDate?: string | null
): Promise<void> {
  await hydrateDevEditionOverrideState();
  await persistState({
    ...memoryState,
    override: {
      ...memoryState.override,
      enabled: true,
      dateMode,
      customEditionDate: customEditionDate ?? memoryState.override.customEditionDate,
    },
    activePreviewId: null,
  });
}
