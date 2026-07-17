/** History Around Town — shared types (keep in sync with lib/edition/historyAroundTown/types.ts). */

export type HistoryPlaceCategory =
  | "historic_district"
  | "historic_home"
  | "museum"
  | "monument"
  | "memorial"
  | "courthouse"
  | "church"
  | "school"
  | "train_depot"
  | "bridge"
  | "military_site"
  | "archaeological_site"
  | "historic_cemetery"
  | "neighborhood"
  | "observatory"
  | "lighthouse"
  | "public_art"
  | "landmark";

export type HistoryPlaceValidationStatus =
  | "needs_review"
  | "approved"
  | "rejected";

export type HistoryPlaceEditorialModule = {
  id: string;
  label: string;
  body: string;
};

export type HistoryPlaceRow = {
  id: string;
  internal_id: string;
  metro_key: string;
  place_name: string;
  slug: string;
  category: HistoryPlaceCategory;
  category_label: string;
  editorial_teaser: string;
  story_body: string;
  editorial_modules: HistoryPlaceEditorialModule[] | null;
  closing_note: string | null;
  history_summary: string | null;
  why_it_matters: string | null;
  interesting_facts: string[] | null;
  architecture_note: string | null;
  best_time_to_visit: string | null;
  hours_text: string | null;
  admission_text: string | null;
  parking_text: string | null;
  accessibility_text: string | null;
  nearby_places: string[] | null;
  lat: number | null;
  lon: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  image_url: string | null;
  hosted_url: string | null;
  storage_path: string | null;
  image_credit: string | null;
  image_source_url: string | null;
  image_license: string | null;
  official_website: string | null;
  source_urls: string[] | null;
  source_provider: string;
  source_provider_place_id: string | null;
  validation_status: HistoryPlaceValidationStatus;
  approval_status: string;
  editorial_priority: number;
  featured: boolean;
  last_reviewed_at: string | null;
  last_shown_date: string | null;
  use_count: number;
};

/** Frozen place — copied into editions.history_around_town at build time. */
export type HistoryPlaceSnapshot = {
  id: string;
  slug: string;
  placeName: string;
  category: HistoryPlaceCategory;
  categoryLabel: string;
  teaser: string;
  body: string[];
  modules: HistoryPlaceEditorialModule[];
  closingNote: string | null;
  heroImageUrl: string | null;
  imageCredit: string | null;
  lat: number | null;
  lon: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  officialWebsite: string | null;
  nearbyPlaces: string[];
};

export type HistoryAroundTownEditionPayload = {
  metroKey: string;
  subtitle: string;
  /** Homepage carousel — up to ~20 curated places. */
  carousel: HistoryPlaceSnapshot[];
  /** Full directory for See All — every approved place in this metro. */
  places: HistoryPlaceSnapshot[];
};

export const HISTORY_AROUND_TOWN_SUBTITLE =
  "Every town has a story waiting to be explored.";

export const HISTORY_AROUND_TOWN_CAROUSEL_LIMIT = 20;

export const CATEGORY_LABELS: Record<HistoryPlaceCategory, string> = {
  historic_district: "Historic District",
  historic_home: "Historic Home",
  museum: "Museum",
  monument: "Monument",
  memorial: "Memorial",
  courthouse: "Courthouse",
  church: "Historic Church",
  school: "Historic School",
  train_depot: "Train Depot",
  bridge: "Historic Bridge",
  military_site: "Military Site",
  archaeological_site: "Archaeological Site",
  historic_cemetery: "Historic Cemetery",
  neighborhood: "Historic Neighborhood",
  observatory: "Observatory",
  lighthouse: "Lighthouse",
  public_art: "Public Art",
  landmark: "Local Landmark",
};
