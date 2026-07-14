/**
 * Phase 17 — Editorial quality audit tests.
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scoreDiscoveryItem } from "../discovery/score.ts";
import type { DiscoveryItem, DiscoveryRankingContext } from "../discovery/types.ts";
import {
  rankLocalEventsForEdition,
  scoreLocalEventForEdition,
} from "../localEvents/ranking.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import { weatherIntelligenceAdjustments } from "../weather/scoring.ts";
import { buildWeatherIntelligence } from "../weather/intelligence.ts";
import type { NormalizedWeatherForecast } from "../weather/providers/types.ts";
import { LOCAL_EVENT_PUBLISH_MIN_SCORE } from "./publishing.ts";

function baseCtx(
  overrides: Partial<DiscoveryRankingContext> = {}
): DiscoveryRankingContext {
  return {
    editionDate: "2026-07-14",
    now: new Date("2026-07-14T12:00:00"),
    city: "Gilbert",
    region: "AZ",
    state: "AZ",
    readerLat: 33.3528,
    readerLon: -111.789,
    interests: [],
    followedTopics: [],
    favoriteSources: [],
    weatherSummary: "Fair and warm.",
    isWeekend: false,
    isSunday: false,
    recentKeys: [],
    ...overrides,
  };
}

function placeItem(
  partial: Partial<DiscoveryItem> & Pick<DiscoveryItem, "id" | "title" | "category">
): DiscoveryItem {
  return {
    dek: "Verified local listing.",
    family: "food_drink",
    source: { name: "Foursquare", tier: "local", url: "https://example.com" },
    url: "https://example.com",
    address: "123 Main St, Gilbert, AZ",
    lat: 33.35,
    lon: -111.79,
    tags: ["local_place", "verified"],
    seasons: ["anytime"],
    weatherFit: ["any"],
    popularity: 0.35,
    uniqueness: 0.4,
    localExpertise: 0.85,
    quality: 0.65,
    ...partial,
  };
}

function rainyIntel() {
  const forecast: NormalizedWeatherForecast = {
    provider: "open_meteo",
    lat: 33.35,
    lon: -111.79,
    retrievedAt: new Date().toISOString(),
    current: {
      temperatureC: 18,
      feelsLikeC: 18,
      weatherCode: 61,
      conditionLabel: "Rain",
      uvi: 2,
      sunrise: 1_700_000_000,
      sunset: 1_700_030_000,
      humidityPct: 80,
      windSpeedMs: 4,
      windGustMs: null,
      precipitationProbability: 0.85,
    },
    daily: [
      {
        date: "2026-07-14",
        tempMaxC: 20,
        tempMinC: 15,
        weatherCode: 61,
        uvi: 3,
        sunrise: 1_700_000_000,
        sunset: 1_700_030_000,
        popMax: 0.9,
        windSpeedMaxMs: 6,
      },
    ],
    hourly: [],
    alerts: [],
    airQuality: null,
    legacy: {
      current: { temperature_2m: 18, weather_code: 61 },
      daily: {
        temperature_2m_max: [20],
        temperature_2m_min: [15],
        weather_code: [61],
      },
    },
  };
  return buildWeatherIntelligence(forecast, "Rain likely this afternoon.");
}

function event(name: string, extra: Partial<LocalEvent> = {}): LocalEvent {
  return {
    name,
    startDateTime: "Sat, Jul 18, 7 PM",
    venue: "Main Hall",
    city: "Gilbert",
    sourceUrl: "https://example.com/event",
    sourceName: "Listing",
    ...extra,
  };
}

Deno.test("official complete event outranks generic community meetup", () => {
  const official = event("Summer Concert Series", {
    startDateTime: "today 7 PM",
    sourceUrl: "https://ticketmaster.com/123",
    sourceName: "Ticketmaster",
    venue: "Downtown Amphitheater",
  });
  const generic = event("Community Meetup", {
    startDateTime: "this weekend",
    venue: "Community Center",
    sourceUrl: "https://example.com/meetup",
  });
  assert(
    scoreLocalEventForEdition(official) > scoreLocalEventForEdition(generic)
  );
  assert(
    scoreLocalEventForEdition(official) >= LOCAL_EVENT_PUBLISH_MIN_SCORE
  );
});

Deno.test("thin generic event stays below publication threshold", () => {
  const thin = event("Community Meetup", {
    startDateTime: "Date TBA",
    venue: "",
    sourceUrl: "https://example.com",
  });
  assert(scoreLocalEventForEdition(thin) < LOCAL_EVENT_PUBLISH_MIN_SCORE);
  assertEquals(rankLocalEventsForEdition([thin]).length, 0);
});

Deno.test("hidden gem coffee outranks generic chain coffee", () => {
  const hidden = placeItem({
    id: "coffee_hidden",
    title: "Side Street Roasters",
    category: "coffee",
    dek: "A neighborhood favorite tucked behind the library — worth the detour.",
    uniqueness: 0.78,
    localExpertise: 0.9,
    quality: 0.82,
  });
  const chain = placeItem({
    id: "coffee_chain",
    title: "Starbucks",
    category: "coffee",
    dek: "123 Main St — Gilbert",
    tags: ["local_place", "verified", "chain"],
    uniqueness: 0.25,
    localExpertise: 0.2,
    quality: 0.48,
  });
  const hiddenScore = scoreDiscoveryItem(hidden, baseCtx()).score;
  const chainScore = scoreDiscoveryItem(chain, baseCtx()).score;
  assert(hiddenScore > chainScore);
  assert(chainScore < 48);
});

Deno.test("scenic overlook outranks parking lot recommendation", () => {
  const overlook = placeItem({
    id: "scenic_1",
    title: "Sunset Scenic Overlook",
    category: "scenic_drives",
    venueCategories: ["Scenic Lookout", "Viewpoint"],
    uniqueness: 0.72,
    quality: 0.82,
  });
  const parking = placeItem({
    id: "lot_1",
    title: "Downtown Parking Lot",
    category: "parks",
    venueCategories: ["Parking Lot"],
    dek: "Convenient parking.",
  });
  assert(
    scoreDiscoveryItem(overlook, baseCtx()).score >
      scoreDiscoveryItem(parking, baseCtx()).score
  );
});

Deno.test("participatory bowling outranks generic activities bucket listing", () => {
  const bowling = placeItem({
    id: "bowl_1",
    title: "Main Street Lanes",
    category: "activities",
    venueCategories: ["Bowling Alley"],
    dek: "Classic lanes with a lively Friday night crowd.",
  });
  const generic = placeItem({
    id: "act_generic",
    title: "Retail Plaza",
    category: "activities",
    venueCategories: ["Shopping Plaza"],
    dek: "A local place worth a closer look.",
  });
  assert(
    scoreDiscoveryItem(bowling, baseCtx()).score >
      scoreDiscoveryItem(generic, baseCtx()).score
  );
  assert(scoreDiscoveryItem(generic, baseCtx()).score < 48);
});

Deno.test("rain boosts comedy club and aquarium over beach", () => {
  const intel = rainyIntel();
  const comedy = placeItem({
    id: "comedy_1",
    title: "Desert Laughs Comedy Club",
    category: "activities",
    venueCategories: ["Comedy Club"],
    weatherFit: ["any", "rainy"],
  });
  const beach = placeItem({
    id: "beach_1",
    title: "Town Beach",
    category: "beaches",
    tags: ["local_place", "verified", "outdoors"],
    weatherFit: ["fair"],
  });
  const comedyScore = scoreDiscoveryItem(comedy, {
    ...baseCtx(),
    weatherIntel: intel,
  }).score;
  const beachScore = scoreDiscoveryItem(beach, {
    ...baseCtx(),
    weatherIntel: intel,
  }).score;
  assert(comedyScore > beachScore);

  const comedyWeather = weatherIntelligenceAdjustments(comedy, intel);
  assert(
    comedyWeather.some((r) => r.code === "weather_comedy_indoor" || r.code === "weather_indoor_activity")
  );
});

Deno.test("fair weather boosts parks and gardens", () => {
  const fairForecast: NormalizedWeatherForecast = {
    provider: "open_meteo",
    lat: 33.35,
    lon: -111.79,
    retrievedAt: new Date().toISOString(),
    current: {
      temperatureC: 24,
      feelsLikeC: 24,
      weatherCode: 1,
      conditionLabel: "Clear",
      uvi: 6,
      sunrise: 1_700_000_000,
      sunset: 1_700_030_000,
      humidityPct: 40,
      windSpeedMs: 2,
      windGustMs: null,
      precipitationProbability: 0.05,
    },
    daily: [
      {
        date: "2026-07-14",
        tempMaxC: 28,
        tempMinC: 18,
        weatherCode: 1,
        uvi: 7,
        sunrise: 1_700_000_000,
        sunset: 1_700_030_000,
        popMax: 0.05,
        windSpeedMaxMs: 3,
      },
    ],
    hourly: [],
    alerts: [],
    airQuality: null,
    legacy: {
      current: { temperature_2m: 24, weather_code: 1 },
      daily: {
        temperature_2m_max: [28],
        temperature_2m_min: [18],
        weather_code: [1],
      },
    },
  };
  const intel = buildWeatherIntelligence(fairForecast, "Clear and pleasant.");
  const garden = placeItem({
    id: "garden_1",
    title: "Desert Botanical Garden",
    category: "gardens",
    venueCategories: ["Botanical Garden"],
  });
  const reasons = weatherIntelligenceAdjustments(garden, intel);
  assert(reasons.some((r) => r.code === "weather_garden_fair"));
});

Deno.test("first items in ranked events reflect strongest editorial facts", () => {
  const events = [
    event("Community Meetup", {
      startDateTime: "this weekend",
      venue: "Hall",
      sourceUrl: "https://example.com/a",
    }),
    event("Ticketed Jazz Night", {
      startDateTime: "today 8 PM",
      venue: "Blue Note",
      sourceUrl: "https://ticketmaster.com/jazz",
      sourceName: "Ticketmaster",
    }),
    event("Farmers Market", {
      startDateTime: "Sat, Jul 18, 8 AM",
      venue: "Town Square",
      sourceUrl: "https://city.gov/market",
      sourceName: "City of Gilbert",
      category: "market",
    }),
  ];
  const ranked = rankLocalEventsForEdition(events);
  assertEquals(ranked[0]?.name, "Ticketed Jazz Night");
});
