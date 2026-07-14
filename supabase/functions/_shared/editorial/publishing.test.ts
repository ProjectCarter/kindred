import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DISCOVERY_PUBLISH_MIN_SCORE,
  LOCAL_EVENT_PUBLISH_MIN_SCORE,
  HOMEPAGE_INITIAL_RENDER_COUNT,
  publishDiscoveryItems,
  sliceForInitialRender,
  SERPAPI_CANDIDATE_CAP,
  SERPAPI_MAX_PAGES,
} from "./publishing.ts";
import { scoreLocalEventForEdition, rankLocalEventsForEdition } from "../localEvents/ranking.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import type { RankedDiscoveryItem } from "../discovery/types.ts";

function ranked(score: number, id: string): RankedDiscoveryItem {
  return {
    score,
    item: {
      id,
      title: `Item ${id}`,
      dek: "Verified listing.",
      category: "restaurants",
      family: "food_drink",
      source: { name: "Foursquare", tier: "local" },
      tags: ["verified"],
      seasons: ["anytime"],
      weatherFit: ["any"],
      popularity: 0.3,
      uniqueness: 0.4,
      localExpertise: 0.8,
      quality: 0.7,
    },
    reasons: [],
    surfaces: [],
  };
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

Deno.test("eight qualifying discovery items publish as eight", () => {
  const items = Array.from({ length: 8 }, (_, i) =>
    ranked(DISCOVERY_PUBLISH_MIN_SCORE + i, `a${i}`)
  );
  assertEquals(publishDiscoveryItems(items).length, 8);
});

Deno.test("thirty-four qualifying discovery items publish as thirty-four", () => {
  const items = Array.from({ length: 34 }, (_, i) =>
    ranked(DISCOVERY_PUBLISH_MIN_SCORE + 1, `b${i}`)
  );
  assertEquals(publishDiscoveryItems(items).length, 34);
});

Deno.test("eighty-seven qualifying discovery items are not editorially truncated", () => {
  const items = Array.from({ length: 87 }, (_, i) =>
    ranked(DISCOVERY_PUBLISH_MIN_SCORE + 2, `c${i}`)
  );
  assertEquals(publishDiscoveryItems(items).length, 87);
});

Deno.test("items below threshold remain unpublished", () => {
  const items = [
    ranked(DISCOVERY_PUBLISH_MIN_SCORE - 1, "weak"),
    ranked(DISCOVERY_PUBLISH_MIN_SCORE, "ok"),
  ];
  const published = publishDiscoveryItems(items);
  assertEquals(published.length, 1);
  assertEquals(published[0].item.id, "ok");
});

Deno.test("higher-quality items rank above weaker items", () => {
  const items = [
    ranked(50, "weak"),
    ranked(90, "strong"),
    ranked(70, "mid"),
  ];
  const published = publishDiscoveryItems(items);
  assertEquals(published.map((p) => p.item.id), ["strong", "mid", "weak"]);
});

Deno.test("initial render slice does not change published edition size", () => {
  const published = Array.from({ length: 34 }, (_, i) => ({ id: i }));
  const initial = sliceForInitialRender(published, HOMEPAGE_INITIAL_RENDER_COUNT);
  assertEquals(initial.length, HOMEPAGE_INITIAL_RENDER_COUNT);
  assertEquals(published.length, 34);
});

Deno.test("local event quality threshold rejects thin listings", () => {
  const thin = event("Thin", {
    startDateTime: "Time TBA",
    venue: "",
    sourceUrl: "",
  });
  const strong = event("Concert", {
    sourceUrl: "https://ticketmaster.com/1",
    sourceName: "Ticketmaster",
  });
  assertEquals(
    scoreLocalEventForEdition(strong) >= LOCAL_EVENT_PUBLISH_MIN_SCORE,
    true
  );
  assertEquals(
    scoreLocalEventForEdition(thin) >= LOCAL_EVENT_PUBLISH_MIN_SCORE,
    false
  );
});

Deno.test("duplicate discovery ids do not inflate final pick count", () => {
  const surfaces = [
    publishDiscoveryItems([ranked(80, "dup"), ranked(70, "unique")]),
    publishDiscoveryItems([ranked(90, "dup"), ranked(60, "other")]),
  ];
  const seen = new Set<string>();
  const picks: string[] = [];
  for (const items of surfaces) {
    for (const item of items) {
      if (seen.has(item.item.id)) continue;
      seen.add(item.item.id);
      picks.push(item.item.id);
    }
  }
  assertEquals(picks.length, 3);
  assertEquals(picks.includes("dup"), true);
});

Deno.test("weather re-ranks local events without dropping eligible items", () => {
  const outdoor = event("Outdoor Festival", {
    category: "market",
    startDateTime: "tomorrow 6 PM",
    sourceUrl: "https://ticketmaster.com/outdoor",
    sourceName: "Ticketmaster",
  });
  const indoor = event("Museum Night", {
    startDateTime: "today 7 PM",
    venue: "Art Museum",
    sourceUrl: "https://museum.example/event",
    sourceName: "City Museum",
  });
  const intel = {
    isRainy: true,
    isStormy: false,
    severeWeather: false,
    isWindy: false,
    bucket: "rainy" as const,
    isHot: false,
    isCold: false,
    isIdealBeachWeather: false,
    isIndoorPreferred: true,
    isIdealSunriseHike: false,
    isIdealMorningOutdoor: false,
    isIdealShadedPark: false,
    isIdealPatios: false,
    rainBeginsAfternoon: false,
    hasActiveAlerts: false,
    alertSummary: null,
    uviHigh: null,
    airQualityPoor: false,
    windSpeedMs: null,
    provider: "open_meteo" as const,
    planningNote: "Rain expected",
  };
  const ranked = rankLocalEventsForEdition([outdoor, indoor], {
    weatherIntel: intel,
  });
  assertEquals(ranked.length, 2);
  assertEquals(ranked[0].name, "Museum Night");
});

Deno.test("category diversity does not discard high-quality qualifying items", () => {
  const items = Array.from({ length: 5 }, (_, i) => {
    const row = ranked(DISCOVERY_PUBLISH_MIN_SCORE + 10 + i, `coffee${i}`);
    row.item.category = "coffee";
    return row;
  });
  assertEquals(publishDiscoveryItems(items).length, 5);
});

Deno.test("provider retrieval ceilings are documented constants", () => {
  assertEquals(SERPAPI_MAX_PAGES, 3);
  assertEquals(SERPAPI_CANDIDATE_CAP, 80);
});
