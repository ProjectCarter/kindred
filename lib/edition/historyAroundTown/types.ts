/** History Around Town — client types (keep in sync with server historyAroundTown/types.ts). */

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

export type HistoryPlaceEditorialModule = {
  id: string;
  label: string;
  body: string;
};

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
  carousel: HistoryPlaceSnapshot[];
  places: HistoryPlaceSnapshot[];
};

export const HISTORY_AROUND_TOWN_SUBTITLE =
  "Every town has a story waiting to be explored.";

export const HISTORY_AROUND_TOWN_CAROUSEL_LIMIT = 20;

export type HistoryAroundTownCard = {
  id: string;
  categoryLabel: string;
  placeName: string;
  teaser: string;
  imageUrl: string | null;
  place: HistoryPlaceSnapshot;
};

export function parseHistoryAroundTownPayload(
  raw: unknown
): HistoryAroundTownEditionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as HistoryAroundTownEditionPayload;
  if (!payload.metroKey?.trim()) return null;
  if (!Array.isArray(payload.places) || !payload.places.length) return null;
  if (!Array.isArray(payload.carousel) || !payload.carousel.length) return null;
  return {
    metroKey: payload.metroKey,
    subtitle: payload.subtitle?.trim() || HISTORY_AROUND_TOWN_SUBTITLE,
    carousel: payload.carousel,
    places: payload.places,
  };
}

export function historyPlaceToCard(place: HistoryPlaceSnapshot): HistoryAroundTownCard {
  return {
    id: place.id,
    categoryLabel: place.categoryLabel,
    placeName: place.placeName,
    teaser: place.teaser,
    imageUrl: place.heroImageUrl,
    place,
  };
}

export function selectHistoryAroundTownCarousel(
  payload: HistoryAroundTownEditionPayload | null | undefined
): HistoryAroundTownCard[] {
  if (!payload?.carousel?.length) return [];
  return payload.carousel.map(historyPlaceToCard);
}
