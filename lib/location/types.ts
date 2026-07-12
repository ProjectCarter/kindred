/**
 * Kindred location — single source of truth for the local paper.
 *
 * Modes:
 * - current  → device GPS (foreground only), refreshed when stale
 * - home     → saved home city
 * - travel   → temporary travel city
 *
 * Never silently defaults to Phoenix or San Francisco.
 * If no city is known, the UI must ask the reader to choose one.
 */

export type LocationMode = "current" | "home" | "travel";

export type KindredPlace = {
  city: string;
  region: string | null;
  state: string | null;
  lat: number;
  lon: number;
};

export type LocationPrefs = {
  mode: LocationMode;
  home: KindredPlace | null;
  travel: KindredPlace | null;
  /** Last successful GPS fix (when mode is current). */
  current: KindredPlace | null;
  currentUpdatedAt: number | null;
  firstRunCompleted: boolean;
};

export type ActiveLocation = {
  place: KindredPlace | null;
  mode: LocationMode;
  /** Short editorial label for UI. */
  modeLabel: string;
  /** True when travel mode is active with a city. */
  isTravel: boolean;
  /** Reader must pick a city or enable GPS before generating. */
  needsSetup: boolean;
};

export const LOCATION_PREFS_KEY = "@kindred/location-prefs-v1";
/** Legacy cache from the first GPS pass — migrated once. */
export const LEGACY_DEVICE_LOCATION_KEY = "@kindred/device-location";

/** GPS fix older than this is refreshed when the app becomes active. */
export const CURRENT_LOCATION_STALE_MS = 6 * 60 * 60 * 1000;
