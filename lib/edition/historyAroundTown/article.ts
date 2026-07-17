import type { KindredArticle } from "../article";
import type { HistoryPlaceSnapshot } from "./types";

function locationLine(place: HistoryPlaceSnapshot): string | null {
  const parts = [place.address, place.city, place.state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * History Around Town → KindredArticle.
 * Reads only from the frozen library snapshot — no runtime generation.
 */
export function articleFromHistoryPlace(place: HistoryPlaceSnapshot): KindredArticle {
  const body = [...place.body];
  if (place.closingNote?.trim()) {
    body.push(place.closingNote.trim());
  }

  const location = locationLine(place);

  return {
    id: `history-around-town:${place.id}`,
    section: "history_around_town",
    headline: place.placeName,
    dek: place.teaser,
    byline: place.categoryLabel,
    source: "Kindred",
    heroImage: place.heroImageUrl
      ? {
          uri: place.heroImageUrl,
          credit: place.imageCredit,
          kind: "editorial",
        }
      : null,
    body,
    modules: place.modules,
    contentType: "history",
    savedContentType: "article",
    savedLocation: location,
    sourceUrl: place.officialWebsite,
    actionContext: {
      mapsDestination:
        place.lat != null && place.lon != null
          ? {
              lat: place.lat,
              lon: place.lon,
              name: place.placeName,
            }
          : place.address
            ? { address: place.address, name: place.placeName }
            : null,
      websiteUrl: place.officialWebsite,
    },
  };
}
