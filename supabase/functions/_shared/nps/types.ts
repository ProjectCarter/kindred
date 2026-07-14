/**
 * National Park Service provider contracts.
 * Server-only — key via NPS_API_KEY (X-Api-Key header, never client-side).
 */

export type NpsProviderId = "nps";

export type NpsAlertRecord = {
  title: string;
  description: string;
  category: string;
  url: string | null;
  lastIndexed: string | null;
};

export type NpsEventRecord = {
  title: string;
  description: string;
  beginDate: string | null;
  endDate: string | null;
  isFree: boolean;
  url: string | null;
};

export type NpsParkRecord = {
  provider: NpsProviderId;
  parkCode: string;
  fullName: string;
  designation: string;
  description: string;
  states: string;
  lat: number | null;
  lon: number | null;
  url: string;
  imageUrl: string | null;
  imageAttribution: string | null;
  entranceFeeSummary: string | null;
  operatingHoursSummary: string | null;
  alerts: NpsAlertRecord[];
  events: NpsEventRecord[];
  distanceKm: number | null;
  /** 0–1 relevance confidence for editorial use. */
  confidence: number;
  sourceAttribution: string;
  retrievedAt: string;
  /** Weather-aware editorial hint — synthesized, not copied from NPS. */
  weatherHint: string | null;
};

export type NpsSearchInput = {
  lat: number;
  lon: number;
  state?: string | null;
  radiusMiles?: number;
  limit?: number;
};

export const NPS_CACHE_TTL_HOURS = 24;
