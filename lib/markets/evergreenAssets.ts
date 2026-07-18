/**
 * Evergreen market content — stored once, reused across editions.
 * Backed by kindred_market_evergreen_assets (migration 0049).
 */

export const EVERGREEN_ASSET_TYPES = [
  "city_history",
  "landmark",
  "museum",
  "park",
  "viewpoint",
  "artwork",
  "historic_district",
  "attraction",
] as const;

export type EvergreenAssetType = (typeof EVERGREEN_ASSET_TYPES)[number];

export type EvergreenAssetRecord = {
  id: string;
  metro_key: string;
  asset_type: EvergreenAssetType;
  slug: string;
  title: string;
  summary: string | null;
  body: Record<string, unknown> | null;
  latitude: number | null;
  longitude: number | null;
  source_uri: string | null;
  license_note: string | null;
  approval_status: "draft" | "review" | "approved" | "archived";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Maps evergreen desks to existing editorial libraries when present. */
export const EVERGREEN_LIBRARY_LINKS = {
  city_history: "kindred_city_articles",
  landmark: "kindred_history_places",
  museum: "kindred_history_places",
  park: "kindred_history_places",
  viewpoint: "kindred_history_places",
  artwork: "kindred_hero_artwork",
  historic_district: "kindred_history_places",
  attraction: "activities_catalog",
} as const satisfies Record<EvergreenAssetType, string>;
