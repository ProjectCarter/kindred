/**
 * Phase 16 — Editorial curation audit tests.
 * Controlled scenarios proving provider signals affect ranking correctly.
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scoreDiscoveryItem } from "./score.ts";
import type { DiscoveryItem, DiscoveryRankingContext } from "./types.ts";
import { selectBanditsPick } from "../bandit/selectPick.ts";
import {
  rankLocalEventsForEdition,
  scoreLocalEventForEdition,
} from "../localEvents/ranking.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import { buildWeatherIntelligence } from "../weather/intelligence.ts";
import type { NormalizedWeatherForecast } from "../weather/providers/types.ts";
import { npsParksAsDiscoveryItems } from "../nps/catalog.ts";
import type { NpsParkRecord } from "../nps/types.ts";

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
    interests: ["outdoors"],
    followedTopics: [],
    favoriteSources: [],
    weatherSummary: "Fair and warm.",
    isWeekend: false,
    isSunday: false,
    recentKeys: [],
    ...overrides,
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
    venueCategories: [],
    ...partial,
  };
}

Deno.test("paid event ranks above photo-only event when timelier", () => {
  const paid: LocalEvent = {
    name: "Summer Concert Series",
    startDateTime: "Sat, Jul 18, 7 PM",
    venue: "Desert Botanical Garden",
    city: "Phoenix",
    sourceUrl: "https://ticketmaster.com/event/123",
    sourceName: "Ticketmaster",
    badges: ["tickets_required"],
  };
  const photoOnly: LocalEvent = {
    name: "Random Meetup",
    startDateTime: "Date TBA",
    venue: "",
    city: "Phoenix",
    sourceUrl: "https://example.com/e",
    sourceName: "Listing",
    imageUrl: "https://example.com/photo.jpg",
  };
  assert(
    scoreLocalEventForEdition(paid, { now: new Date("2026-07-14") }) >
      scoreLocalEventForEdition(photoOnly, { now: new Date("2026-07-14") })
  );
});

Deno.test("free event with complete facts outranks thin listing", () => {
  const free: LocalEvent = {
    name: "Community Yoga in the Park",
    startDateTime: "Sun, Jul 19, 8 AM",
    venue: "Freestone Park",
    city: "Gilbert",
    sourceUrl: "https://gilbertaz.gov/events/yoga",
    sourceName: "City of Gilbert",
    badges: ["free"],
  };
  const thin: LocalEvent = {
    name: "TBA Event",
    startDateTime: "Time TBA",
    venue: "",
    city: "Gilbert",
    sourceUrl: "https://example.com",
    sourceName: "Listing",
  };
  assert(scoreLocalEventForEdition(free) > scoreLocalEventForEdition(thin));
});

Deno.test("rainy weather deprioritizes outdoor events in local ranking", () => {
  const outdoor: LocalEvent = {
    name: "Outdoor Concert",
    startDateTime: "Sat, Jul 18, 7 PM",
    venue: "Amphitheater",
    city: "Gilbert",
    sourceUrl: "https://example.com",
    sourceName: "Listing",
    category: "music",
  };
  const indoor: LocalEvent = {
    name: "Comedy Night",
    startDateTime: "Sat, Jul 18, 8 PM",
    venue: "Laugh Factory",
    city: "Gilbert",
    sourceUrl: "https://example.com",
    sourceName: "Listing",
    category: "comedy",
  };
  const intel = rainyIntel();
  const ranked = rankLocalEventsForEdition([outdoor, indoor], {
    weatherIntel: intel,
  });
  assertEquals(ranked[0].name, "Comedy Night");
});

Deno.test("indoor activity beats outdoor beach on rainy day", () => {
  const ctx = baseCtx({ weatherIntel: rainyIntel() ?? undefined });
  const bowling = placeItem({
    id: "act_bowl",
    title: "Main Event Gilbert",
    category: "activities",
    venueCategories: ["Bowling Alley"],
    weatherFit: ["any", "rainy", "cool", "fair"],
  });
  const beach = placeItem({
    id: "rec_beach",
    title: "Waterfront Park",
    category: "beaches",
    tags: ["outdoors", "verified"],
    weatherFit: ["fair"],
  });
  const bowlingScore = scoreDiscoveryItem(bowling, ctx).score;
  const beachScore = scoreDiscoveryItem(beach, ctx).score;
  assert(bowlingScore > beachScore);
});

Deno.test("restaurant ranks on identity signals not image presence", () => {
  const ctx = baseCtx();
  const restaurant = placeItem({
    id: "rec_rest",
    title: "The Neighbor's Table",
    category: "restaurants",
    dek: "A neighborhood dinner worth planning around — seasonal menu, local produce.",
    quality: 0.72,
    uniqueness: 0.55,
  });
  const ranked = scoreDiscoveryItem(restaurant, ctx);
  assert(ranked.reasons.some((r) => r.code === "local_expertise" || r.code === "location_match"));
  assert(!ranked.reasons.some((r) => /image|photo|stock/i.test(r.label)));
});

Deno.test("museum scores with proximity and weather indoor preference", () => {
  const ctx = baseCtx({ weatherIntel: rainyIntel() ?? undefined });
  const museum = placeItem({
    id: "rec_museum",
    title: "Arizona Museum of Natural History",
    category: "museums",
    weatherFit: ["any", "rainy", "cool", "fair"],
    quality: 0.88,
    venueCategories: ["Museum"],
  });
  const ranked = scoreDiscoveryItem(museum, ctx);
  assert(ranked.reasons.some((r) => r.code === "proximity_near" || r.code === "location_match"));
  assert(ranked.reasons.some((r) => r.code === "weather_museum_indoor"));
});

Deno.test("NPS park requires geographic confidence and boosts when near", () => {
  const park: NpsParkRecord = {
    provider: "nps",
    parkCode: "yose",
    fullName: "Yosemite National Park",
    designation: "National Park",
    description: "Granite cliffs.",
    states: "CA",
    lat: 37.8651,
    lon: -119.5383,
    url: "https://www.nps.gov/yose/index.htm",
    imageUrl: null,
    imageAttribution: null,
    entranceFeeSummary: null,
    operatingHoursSummary: null,
    alerts: [],
    events: [],
    distanceKm: 45,
    confidence: 0.92,
    sourceAttribution: "NPS",
    retrievedAt: new Date().toISOString(),
    weatherHint: null,
  };
  const nearCtx = baseCtx({ readerLat: 37.86, readerLon: -119.54 });
  const item = npsParksAsDiscoveryItems([park])[0];
  const ranked = scoreDiscoveryItem(item, nearCtx);
  assert(ranked.reasons.some((r) => r.code === "nps_high_confidence"));

  const farCtx = baseCtx({ readerLat: 33.35, readerLon: -111.79 });
  const farRanked = scoreDiscoveryItem(item, farCtx);
  assert(
    (farRanked.reasons.find((r) => r.code === "proximity_far_nps")?.weight ?? 0) < 0
  );
});

Deno.test("Bandit's Pick can select verified NPS park with explainable reasons", () => {
  const park: NpsParkRecord = {
    provider: "nps",
    parkCode: "sagu",
    fullName: "Saguaro National Park",
    designation: "National Park",
    description: "Desert trails and saguaro forests.",
    states: "AZ",
    lat: 32.174,
    lon: -110.737,
    url: "https://www.nps.gov/sagu/index.htm",
    imageUrl: null,
    imageAttribution: null,
    entranceFeeSummary: null,
    operatingHoursSummary: null,
    alerts: [],
    events: [],
    distanceKm: 35,
    confidence: 0.92,
    sourceAttribution: "NPS",
    retrievedAt: new Date().toISOString(),
    weatherHint: "Clear morning — start early before the heat.",
  };
  const pick = selectBanditsPick({
    scored: [],
    discovery: baseCtx({
      npsParks: [park],
      localPlaces: [],
    }),
    localEvents: [],
  });
  assert(pick);
  assertEquals(pick?.kind === "activity" || pick?.kind === "hidden_gem", true);
  assert(pick?.discoveryItem?.tags.includes("nps_park"));
  assert(pick?.why.length > 0);
});

Deno.test("favorite source personalization boosts matching discovery item", () => {
  const ctx = baseCtx({ favoriteSources: ["National Geographic"] });
  const item = placeItem({
    id: "seed_1",
    title: "Scenic overlook",
    category: "scenic_drives",
    source: { name: "National Geographic", tier: "magazine" },
    tags: ["verified"],
    quality: 0.9,
  });
  const withFav = scoreDiscoveryItem(item, ctx);
  const withoutFav = scoreDiscoveryItem(item, baseCtx());
  assert(withFav.score > withoutFav.score);
  assert(withFav.reasons.some((r) => r.code === "favorite_source"));
});
