import type { KindredArticle } from "../article";
import type { HistoryPlaceSnapshot } from "./types";
import { cityRegionLine, normalizeHistoryPlaceSnapshot } from "./types";
import { resolveStateAtAGlanceForPlace } from "../stateAtAGlance";

function locationLine(place: HistoryPlaceSnapshot): string | null {
  const parts = [place.address, place.city, place.state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * History Around Town → KindredArticle.
 * Reads only from the frozen library snapshot — no runtime generation.
 */
export function articleFromHistoryPlace(
  place: HistoryPlaceSnapshot,
  options?: { metroKey?: string | null }
): KindredArticle {
  const snapshot = normalizeHistoryPlaceSnapshot(place);
  const location = locationLine(snapshot);
  const region = cityRegionLine(snapshot);

  return {
    id: `history-around-town:${snapshot.id}`,
    section: "history_around_town",
    headline: snapshot.placeName,
    dek: snapshot.teaser,
    byline: [snapshot.categoryLabel, region].filter(Boolean).join(" · "),
    source: "Kindred",
    heroImage: snapshot.heroImageUrl
      ? {
          uri: snapshot.heroImageUrl,
          credit: snapshot.imageCredit,
          caption: snapshot.historicalMetadataLine ?? undefined,
          kind: "historical",
        }
      : null,
    body: snapshot.theStory.length ? snapshot.theStory : snapshot.body,
    modules: [],
    contentType: "history",
    savedContentType: "article",
    savedLocation: location,
    sourceUrl: snapshot.officialWebsite,
    historyPlaceSnapshot: snapshot,
    stateAtAGlance: resolveStateAtAGlanceForPlace({
      metroKey: options?.metroKey,
      state: snapshot.state,
    }),
    actionContext: {
      surface: "history_around_town",
      mapsDestination:
        snapshot.lat != null && snapshot.lon != null
          ? {
              lat: snapshot.lat,
              lon: snapshot.lon,
              name: snapshot.placeName,
              city: snapshot.city,
              state: snapshot.state,
              address: snapshot.address,
            }
          : snapshot.address
            ? {
                address: snapshot.address,
                name: snapshot.placeName,
                city: snapshot.city,
                state: snapshot.state,
              }
            : null,
      websiteUrl: snapshot.officialWebsite,
      ticketUrl: snapshot.admissionUrl,
      phone: snapshot.phone,
    },
  };
}
