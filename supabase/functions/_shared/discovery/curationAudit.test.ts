/**
 * Phase 16 — Editorial curation audit tests.
 * Controlled scenarios proving provider signals affect ranking correctly.
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scoreDiscoveryItem } from "./score.ts";
import { selectDiscoverySurface } from "./select.ts";
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

Deno.test("recommendations surfaces exclude statewide monuments outside local radius", () => {
  const monument: NpsParkRecord = {
    provider: "nps",
    parkCode: "orpi",
    fullName: "Organ Pipe Cactus National Monument",
    designation: "National Monument",
    description: "Sonoran Desert landscape.",
    states: "AZ",
    lat: 31.9544,
    lon: -112.7997,
    url: "https://www.nps.gov/orpi/index.htm",
    imageUrl: null,
    imageAttribution: null,
    entranceFeeSummary: null,
    operatingHoursSummary: null,
    alerts: [],
    events: [],
    distanceKm: 220,
    confidence: 0.92,
    sourceAttribution: "NPS",
    retrievedAt: new Date().toISOString(),
    weatherHint: null,
  };
  const ctx = baseCtx({
    readerLat: 33.3528,
    readerLon: -111.789,
    city: "Gilbert",
    state: "AZ",
  });
  const ranked = npsParksAsDiscoveryItems([monument]).map((item) =>
    scoreDiscoveryItem(item, ctx)
  );
  const museums = selectDiscoverySurface(ranked, "museums", ctx);
  assertEquals(museums.items.length, 0);
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

Deno.test("Bandit's Pick rejects seasonal calendar without local evidence", () => {
  const pick = selectBanditsPick({
    discovery: baseCtx({
      editionDate: "2026-01-14",
      now: new Date("2026-01-14T12:00:00"),
      city: "Gilbert",
      state: "AZ",
      localPlaces: [],
    }),
    localEvents: [],
  });
  assertEquals(pick, null);
});

Deno.test("Bandit's Pick publishes verified seasonal experience without a venue", () => {
  const pick = selectBanditsPick({
    discovery: baseCtx({
      editionDate: "2026-07-14",
      now: new Date("2026-07-14T12:00:00"),
      city: "Gilbert",
      state: "AZ",
      localPlaces: [],
    }),
    localEvents: [],
  });
  assert(pick);
  assertEquals(pick?.kind, "seasonal");
  assert(pick?.headline.toLowerCase().includes("monsoon"));
  assert(!pick?.why || !/\b(verified|experience verified)\b/i.test(pick.why));
});

Deno.test("Bandit's Pick publishes harvest pick only with verified venue", () => {
  const pick = selectBanditsPick({
    discovery: baseCtx({
      editionDate: "2026-07-14",
      now: new Date("2026-07-14T12:00:00"),
      city: "Traverse City",
      region: "MI",
      state: "MI",
      localPlaces: [
        {
          providerId: "fsq_1",
          name: "King Orchards U-Pick Blueberries",
          category: "attractions",
          address: "123 Farm Rd",
          city: "Traverse City",
          url: "https://example.com/farm",
          note: "U-pick blueberries open weekday mornings in July.",
        },
      ],
    }),
    localEvents: [],
  });
  assert(pick);
  assertEquals(pick?.kind, "seasonal");
  assert(pick?.headline.toLowerCase().includes("blueberr"));
  assert((pick?.nearby.length ?? 0) >= 1);
  assert(!pick?.why || !/\bverified near\b/i.test(pick.why));
});

Deno.test("Bandit's Pick blocks blueberry harvest in desert regions", () => {
  const pick = selectBanditsPick({
    discovery: baseCtx({
      editionDate: "2026-07-14",
      now: new Date("2026-07-14T12:00:00"),
      city: "Gilbert",
      state: "AZ",
      localPlaces: [
        {
          providerId: "fsq_1",
          name: "Agritopia Farm U-Pick Blueberries",
          category: "attractions",
          address: "3000 E Agritopia Loop",
          city: "Gilbert",
          url: "https://example.com/farm",
          note: "U-pick blueberries open weekday mornings in July.",
        },
      ],
    }),
    localEvents: [],
  });
  assert(pick);
  assert(!pick?.headline.toLowerCase().includes("blueberr"));
});

Deno.test("Bandit's Pick rejects generic farm as blueberry evidence", () => {
  const pick = selectBanditsPick({
    discovery: baseCtx({
      editionDate: "2026-07-14",
      now: new Date("2026-07-14T12:00:00"),
      city: "Gilbert",
      state: "AZ",
      localPlaces: [
        {
          providerId: "fsq_garden",
          name: "Desert Breeze Community Garden",
          category: "gardens",
          address: "100 S Main St",
          city: "Gilbert",
          url: null,
          note: "Community garden plots and weekend produce stand.",
        },
      ],
    }),
    localEvents: [],
  });
  assert(pick);
  assert(!pick?.headline.toLowerCase().includes("blueberr"));
});

Deno.test("Bandit's Pick rejects networking events", () => {
  const networking: LocalEvent = {
    name: "Startup Networking Night",
    startDateTime: "Sat, Jul 18, 7 PM",
    venue: "WeWork",
    city: "Gilbert",
    sourceUrl: "https://example.com/event",
    sourceName: "Eventbrite",
  };
  const pick = selectBanditsPick({
    discovery: baseCtx({
      editionDate: "2026-07-14",
      now: new Date("2026-07-14T12:00:00"),
      state: "AZ",
      localPlaces: [],
    }),
    localEvents: [networking],
  });
  assert(pick);
  assert(!/networking/i.test(pick?.headline ?? ""));
});

Deno.test("Bandit's Pick selects verified local event when no experience wins", () => {
  const farmersMarket: LocalEvent = {
    name: "Gilbert Farmers Market",
    startDateTime: "Sat, Feb 12, 7 AM",
    venue: "Downtown Gilbert",
    city: "Gilbert",
    sourceUrl: "https://example.com/market",
    sourceName: "Town of Gilbert",
    banditNote: "Saturday farmers market with peak winter produce.",
  };
  const pick = selectBanditsPick({
    discovery: baseCtx({
      editionDate: "2026-02-12",
      now: new Date("2026-02-12T12:00:00"),
      city: "Gilbert",
      state: "AZ",
      localPlaces: [],
    }),
    localEvents: [farmersMarket],
  });
  assert(pick);
  assertEquals(pick?.kind, "event");
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
