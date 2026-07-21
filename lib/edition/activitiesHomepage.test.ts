import test from "node:test";
import assert from "node:assert/strict";
import type { RankedDiscoveryItem } from "./discovery.ts";
import {
  ACTIVITIES_HOMEPAGE_MAX_BOWLING,
  classifyActivityDiversityCategory,
  curateActivitiesForHomepage,
  filterEligibleActivitiesForDesk,
  isActivityProShopItem,
  selectEditorialHomepageActivities,
} from "./activitiesHomepage.ts";

function activity(
  id: string,
  title: string,
  category: RankedDiscoveryItem["item"]["category"],
  score: number,
  extra?: Partial<RankedDiscoveryItem["item"]>
): RankedDiscoveryItem {
  return {
    score,
    item: {
      id,
      title,
      dek: `${title} note`,
      category,
      family: "discovery",
      tags: [],
      source: { name: "test", tier: "local" },
      seasons: [],
      weatherFit: [],
      popularity: 0,
      uniqueness: 0,
      reasons: [],
      place: { city: "Gilbert" },
      ...extra,
    } as RankedDiscoveryItem["item"],
    reasons: [],
  } as RankedDiscoveryItem;
}

test("rejects pro shops from the activities desk pool", () => {
  assert.equal(
    isActivityProShopItem(activity("1", "Bowling Pro Shop Supply Store", "activities", 80)),
    true
  );
  assert.equal(
    isActivityProShopItem(activity("2", "Bowlero Chandler", "activities", 80)),
    false
  );

  const pool = filterEligibleActivitiesForDesk([
    activity("1", "Bowling Pro Shop Supply Store", "activities", 90),
    activity("2", "Bowlero Chandler", "activities", 70),
  ]);
  assert.equal(pool.length, 1);
  assert.match(pool[0]!.item.title, /Bowlero/i);
});

test("homepage spread caps bowling at two and favors destination variety", () => {
  const pool = [
    activity("b1", "Bowlero Gilbert", "activities", 95),
    activity("b2", "Bowlero Mesa", "activities", 94),
    activity("b3", "Bowlero Tempe", "activities", 93),
    activity("b4", "Bowlero Scottsdale", "activities", 92),
    activity("h1", "Usery Mountain Trailhead", "hiking", 88),
    activity("m1", "Phoenix Art Museum", "museums", 87),
    activity("g1", "Desert Botanical Garden", "gardens", 86),
    activity("e1", "Escape Room Gilbert", "activities", 85, {
      venueCategories: ["Escape Room"],
    }),
    activity("k1", "Salt River Kayak Launch", "activities", 84, {
      venueCategories: ["Kayak Rental"],
    }),
    activity("c1", "Arizona Climbing Gym", "activities", 83, {
      venueCategories: ["Rock Climbing Gym"],
    }),
    activity("p1", "Gilbert Pickleball Courts", "activities", 82, {
      venueCategories: ["Pickleball"],
    }),
    activity("s1", "Dobbins Lookout", "scenic_drives", 81),
  ];

  const { homepage } = selectEditorialHomepageActivities(pool, { maxTotal: 8 });
  assert.equal(homepage.length, 8);

  const bowlingCount = homepage.filter(
    (item) => classifyActivityDiversityCategory(item) === "bowling"
  ).length;
  assert.ok(
    bowlingCount <= ACTIVITIES_HOMEPAGE_MAX_BOWLING,
    `expected at most ${ACTIVITIES_HOMEPAGE_MAX_BOWLING} bowling picks, got ${bowlingCount}`
  );

  const categories = new Set(homepage.map(classifyActivityDiversityCategory));
  assert.ok(categories.has("hiking"));
  assert.ok(categories.has("museums"));
  assert.ok(categories.has("botanical_garden"));
  assert.ok(categories.has("scenic") || categories.has("park"));
});

test("curateActivitiesForHomepage preserves spread-first ordering", () => {
  const pool = [
    activity("b1", "Bowlero A", "activities", 95),
    activity("b2", "Bowlero B", "activities", 94),
    activity("b3", "Bowlero C", "activities", 93),
    activity("h1", "Papago Park Trail", "hiking", 80),
    activity("m1", "Heard Museum", "museums", 79),
  ];

  const curated = curateActivitiesForHomepage(pool, { initialRenderCount: 4 });
  assert.equal(curated.length, 5);
  const topFour = curated.slice(0, 4);
  const topBowling = topFour.filter(
    (item) => classifyActivityDiversityCategory(item) === "bowling"
  ).length;
  assert.ok(topBowling <= ACTIVITIES_HOMEPAGE_MAX_BOWLING);
  assert.ok(topFour.some((item) => item.item.category === "hiking"));
  assert.ok(topFour.some((item) => item.item.category === "museums"));
});
