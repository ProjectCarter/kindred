import type { KindredPlace } from "../location/types";
import type { CachedEditionBundle } from "../edition/editionCache";
import type { EditionHealthReport } from "./editionHealthReport";

export type EditionDateMode = "today" | "tomorrow" | "custom";

export type DevEditionOverride = {
  enabled: boolean;
  place: KindredPlace | null;
  dateMode: EditionDateMode;
  /** YYYY-MM-DD when dateMode === "custom" */
  customEditionDate: string | null;
};

export type DevEditionDiagnostics = {
  city: string | null;
  country: string | null;
  state: string | null;
  coordinates: { lat: number; lon: number } | null;
  metroId: string | null;
  timeZone: string;
  localDate: string;
  editionDate: string;
  editionGeneratedAt: string | null;
  cacheStatus: "memory" | "disk" | "network" | "preview" | "none";
  radiusMiles: number;
  totalEvents: number;
  sportsEvents: number;
  activities: number;
  restaurants: number;
  newsStories: number;
  historicalArticles: number;
  generationTimeMs: number | null;
  apiErrors: string[];
};

export type DevEditionHistoryEntry = {
  id: string;
  label: string;
  place: KindredPlace;
  editionDate: string;
  editionId: string;
  generatedAt: string;
  generationTimeMs: number | null;
  diagnostics: DevEditionDiagnostics;
  bundle: CachedEditionBundle;
  /** QA health report — recomputed on read if missing (legacy snapshots). */
  health?: EditionHealthReport;
};

export type DevCompareSlots = {
  slotAId: string | null;
  slotBId: string | null;
};

export type DevEditionOverrideState = {
  override: DevEditionOverride;
  favorites: KindredPlace[];
  recentPlaces: KindredPlace[];
  history: DevEditionHistoryEntry[];
  compare: DevCompareSlots;
  /** When set, home previews this history entry without hitting the network. */
  activePreviewId: string | null;
};

export const DEFAULT_DEV_EDITION_OVERRIDE: DevEditionOverride = {
  enabled: false,
  place: null,
  dateMode: "today",
  customEditionDate: null,
};

export const DEFAULT_DEV_EDITION_OVERRIDE_STATE: DevEditionOverrideState = {
  override: DEFAULT_DEV_EDITION_OVERRIDE,
  favorites: [],
  recentPlaces: [],
  history: [],
  compare: { slotAId: null, slotBId: null },
  activePreviewId: null,
};
