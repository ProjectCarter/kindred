import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyEditionCurationToAllocation,
  buildEditionAnchors,
  curateOrderedList,
  EditionCurationContext,
  inferEditionFingerprintFromDiscoveryItem,
  inferEditionFingerprintFromHay,
  MAX_FINGERPRINT_ON_EDITION,
} from "./editionCuration.ts";
import type { RankedDiscoveryItem } from "../discovery/types.ts";
import type { SectionAllocation } from "../discovery/sectionAllocation.ts";

function mockDiscoveryItem(
  id: string,
  title: string,
  category: RankedDiscoveryItem["item"]["category"],
  score: number
): RankedDiscoveryItem {
  return {
    score,
    item: {
      id,
      title,
      dek: "",
      category,
      family: "food_drink",
      tags: [],
      source: { name: "test", tier: "local" },
      seasons: [],
      weatherFit: [],
      popularity: 0,
      uniqueness: 0,
      reasons: [],
    } as unknown as RankedDiscoveryItem["item"],
    reasons: [],
  } as unknown as RankedDiscoveryItem;
}

Deno.test("inferEditionFingerprintFromHay recognizes breweries and gardens", () => {
  assertEquals(
    inferEditionFingerprintFromHay("Desert Eagle Brewing taproom"),
    "brewery_winery_bar"
  );
  assertEquals(
    inferEditionFingerprintFromHay("Desert Botanical Garden conservatory"),
    "botanical_garden"
  );
});

Deno.test("curateOrderedList prefers diversity within a score tie band", () => {
  const context = new EditionCurationContext();
  context.record("brewery_winery_bar");
  context.record("brewery_winery_bar");

  const items = [
    { id: "brew-a", score: 80, title: "Sunset Brewery taproom" },
    { id: "garden", score: 79, title: "Desert Botanical Garden" },
    { id: "brew-b", score: 78, title: "Copper State Brewing Company" },
  ];

  const curated = curateOrderedList(items, {
    getScore: (item) => item.score,
    getFingerprint: (item) => inferEditionFingerprintFromHay(item.title),
    context,
    tieScoreDelta: 4,
    curateDepth: 1,
  });

  assertEquals(curated[0]?.id, "garden");
});

Deno.test("curateOrderedList never demotes a clearly stronger story", () => {
  const context = new EditionCurationContext();
  context.record("hike_trail");
  context.record("hike_trail");

  const items = [
    { id: "hike-a", score: 90, title: "Camelback Mountain Trail" },
    { id: "museum", score: 70, title: "Phoenix Art Museum" },
    { id: "hike-b", score: 89, title: "Piestewa Peak Summit Trail" },
  ];

  const curated = curateOrderedList(items, {
    getScore: (item) => item.score,
    getFingerprint: (item) => inferEditionFingerprintFromHay(item.title),
    context,
    tieScoreDelta: 4,
    curateDepth: 1,
  });

  assertEquals(curated[0]?.id, "hike-a");
});

Deno.test("applyEditionCurationToAllocation spreads brewery picks across sections", () => {
  const allocation: SectionAllocation = {
    activities: [],
    notebook: [],
    recommendations: [
      mockDiscoveryItem("brew-1", "First Street Brewery", "restaurants", 80),
      mockDiscoveryItem("brew-2", "Copper Tank Brewing", "restaurants", 79),
      mockDiscoveryItem("garden", "Desert Botanical Garden", "gardens", 78),
      mockDiscoveryItem("brew-3", "Desert Eagle Brewing", "restaurants", 77),
    ],
  };

  const context = new EditionCurationContext();
  const curated = applyEditionCurationToAllocation(allocation, context);
  const topThree = curated.recommendations.slice(0, 3).map((item) => item.item.id);

  assert(topThree.includes("garden"));
  assertNotEquals(topThree.filter((id) => id.startsWith("brew")).length, 3);
});

Deno.test("curateDiscoveryAllocation prefers variety when edition already has hikes", () => {
  const allocation: SectionAllocation = {
    activities: [
      mockDiscoveryItem("hike-1", "Camelback Mountain Trail", "hiking", 82),
      mockDiscoveryItem("hike-2", "Piestewa Peak Summit Trail", "hiking", 81),
      mockDiscoveryItem("kayak", "Salt River Paddleboarding", "activities", 80),
    ],
    notebook: [],
    recommendations: [],
  };

  const context = new EditionCurationContext();
  context.record("hike_trail");
  context.record("hike_trail");

  const curated = applyEditionCurationToAllocation(allocation, context);
  assertEquals(curated.activities[0]?.item.id, "kayak");
});

Deno.test("MAX_FINGERPRINT_ON_EDITION caps repeated fingerprints in tie bands", () => {
  assertEquals(MAX_FINGERPRINT_ON_EDITION, 2);
  const context = new EditionCurationContext();
  context.record("museum_gallery");
  context.record("museum_gallery");

  const items = [
    { id: "museum-a", score: 80, title: "Phoenix Art Museum" },
    { id: "park", score: 79, title: "Desert Ridge Park playground" },
    { id: "museum-b", score: 78, title: "Heard Museum gallery exhibit" },
  ];

  const curated = curateOrderedList(items, {
    getScore: (item) => item.score,
    getFingerprint: (item) => inferEditionFingerprintFromHay(item.title),
    context,
    tieScoreDelta: 4,
    curateDepth: 1,
  });

  assertEquals(curated[0]?.id, "park");
});

Deno.test("buildEditionAnchors maps history and hero into edition fingerprints", () => {
  const anchors = buildEditionAnchors({
    historyHeadline: "First powered flight in aviation history",
    heroStyle: "impressionist landscape painting",
  });
  assertEquals(anchors.todayInHistory?.fingerprint, "aviation_history");
  assertEquals(anchors.heroArt?.fingerprint, "artistic_culture");
});

Deno.test("inferEditionFingerprintFromDiscoveryItem uses discovery category", () => {
  const hike = mockDiscoveryItem("hike", "South Mountain Preserve", "hiking", 70);
  assertEquals(
    inferEditionFingerprintFromDiscoveryItem(hike),
    "hike_trail"
  );
});
