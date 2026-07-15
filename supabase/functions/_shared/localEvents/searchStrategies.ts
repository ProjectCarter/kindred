/**
 * Editorial discovery strategies — comprehensive gather, editorial rank later.
 *
 * Eventbrite surfaces more events because it queries by category, neighborhood,
 * and metro radius. Kindred mirrors that breadth through targeted SerpAPI
 * Google Events searches without copying Eventbrite's UI or ranking.
 */

import type { LocalEventLocation } from "./provider.ts";

export type EditorialDiscoveryStrategy = {
  id: string;
  /** SerpAPI `q` parameter */
  searchQuery: string;
  htichips: string | null;
  /** Pagination safety per strategy — general query gets more pages. */
  maxPages: number;
};

function cityState(location: LocalEventLocation): { city: string; state: string } {
  const city = location.city?.trim() || "your area";
  const state = location.state?.trim() ?? "";
  return { city, state };
}

/**
 * Category-targeted searches inspired by what strong local calendars surface —
 * live music, festivals, markets, comedy, family, sports, etc.
 */
export function buildEditorialDiscoveryStrategies(
  location: LocalEventLocation
): EditorialDiscoveryStrategy[] {
  const { city, state } = cityState(location);
  const region = state ? `${city} ${state}` : city;

  return [
    {
      id: "general_month",
      searchQuery: `Events in ${region}`,
      htichips: "date:month",
      maxPages: 3,
    },
    {
      id: "general_week",
      searchQuery: `Events in ${region}`,
      htichips: "date:week",
      maxPages: 2,
    },
    {
      id: "mesa_month",
      searchQuery: `Events in Mesa ${state}`,
      htichips: "date:month",
      maxPages: 2,
    },
    {
      id: "chandler_month",
      searchQuery: `Events in Chandler ${state}`,
      htichips: "date:month",
      maxPages: 2,
    },
    {
      id: "tempe_month",
      searchQuery: `Events in Tempe ${state}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "live_music",
      searchQuery: `live music concerts ${region}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "comedy",
      searchQuery: `comedy shows stand-up ${city}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "festivals",
      searchQuery: `festivals fairs ${region}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "farmers_market",
      searchQuery: `farmers market ${city}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "food_drink",
      searchQuery: `food festival brewery tasting ${region}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "family",
      searchQuery: `family events kids ${city}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "sports",
      searchQuery: `sports tournament marathon race ${region}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "arts_culture",
      searchQuery: `theater museum exhibit art walk ${city}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "community",
      searchQuery: `community events parade celebration ${city}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "car_shows",
      searchQuery: `car show auto show ${region}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "classes",
      searchQuery: `classes workshops ${city}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "outdoor",
      searchQuery: `outdoor recreation hiking festival ${region}`,
      htichips: "date:month",
      maxPages: 1,
    },
    {
      id: "seasonal",
      searchQuery: `seasonal events holiday ${region}`,
      htichips: "date:month",
      maxPages: 1,
    },
  ];
}
