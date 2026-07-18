import type { EditorialGridCard } from "../../../components/EditorialCardGrid";
import type { HistoryPlaceSnapshot } from "./types";
import { cityRegionLine } from "./types";

export type HistoryDirectoryCard = EditorialGridCard & {
  imageUrl: string | null;
  historicalMetadataLine: string | null;
};

export function selectHistoryAroundTownGridCards(
  places: HistoryPlaceSnapshot[]
): HistoryDirectoryCard[] {
  return places.map((place) => ({
    id: place.id,
    overline: place.categoryLabel,
    title: place.placeName,
    note: place.teaser,
    subtitle: cityRegionLine(place),
    imageUrl: place.heroImageUrl,
    historicalMetadataLine: place.historicalMetadataLine,
  }));
}
