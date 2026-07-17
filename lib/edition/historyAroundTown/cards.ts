import type { EditorialGridCard } from "../../../components/EditorialCardGrid";
import type { HistoryPlaceSnapshot } from "./types";

export function selectHistoryAroundTownGridCards(
  places: HistoryPlaceSnapshot[]
): EditorialGridCard[] {
  return places.map((place) => ({
    id: place.id,
    overline: place.categoryLabel,
    title: place.placeName,
    note: place.teaser,
    subtitle: [place.city, place.state].filter(Boolean).join(", ") || null,
  }));
}
