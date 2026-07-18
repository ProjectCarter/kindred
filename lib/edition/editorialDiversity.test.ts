/**
 * Editorial spread selection — unit tests.
 */

import { assertEquals } from "jsr:@std/assert";
import {
  computeEditorialDiversityPenalty,
  isVenueEligibleForSpread,
  LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  selectEditorialSpread,
} from "./editorialDiversity.ts";

type TestCard = {
  id: string;
  name: string;
  venue: string;
  city: string;
  category: string;
  score: number;
};

Deno.test("selectEditorialSpread limits duplicate venues when alternatives exist", () => {
  const candidates: TestCard[] = [
    { id: "1", name: "Show A", venue: "Chandler Center", city: "Chandler", category: "music", score: 30 },
    { id: "2", name: "Show B", venue: "Chandler Center", city: "Chandler", category: "music", score: 29 },
    { id: "3", name: "Game", venue: "Chase Field", city: "Phoenix", category: "sports", score: 28 },
    { id: "4", name: "Fair", venue: "Mesa Park", city: "Mesa", category: "festival", score: 27 },
    { id: "5", name: "Comedy", venue: "Tempe Improv", city: "Tempe", category: "comedy", score: 26 },
    { id: "6", name: "Market", venue: "Gilbert Hall", city: "Gilbert", category: "market", score: 25 },
    { id: "7", name: "Art Walk", venue: "Scottsdale Arts", city: "Scottsdale", category: "arts", score: 24 },
    { id: "8", name: "Food Fest", venue: "Queen Creek", city: "Queen Creek", category: "food", score: 23 },
    { id: "9", name: "Show C", venue: "Chandler Center", city: "Chandler", category: "music", score: 22 },
  ];

  const { selected } = selectEditorialSpread(candidates, {
    maxSlots: 8,
    getBaseScore: (item) => item.score,
    getItemKey: (item) => item.id,
    getVenueKey: (item) => item.venue,
    getGeographyKey: (item) => item.city,
    getCategoryKey: (item) => item.category,
    weights: LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  });

  assertEquals(selected.length, 8);
  assertEquals(
    selected.filter((item) => item.venue === "Chandler Center").length,
    1
  );
});

Deno.test("selectEditorialSpread allows venue repeat when pool is too thin", () => {
  const candidates: TestCard[] = [
    { id: "1", name: "Show A", venue: "Only Hall", city: "Chandler", category: "music", score: 30 },
    { id: "2", name: "Show B", venue: "Only Hall", city: "Chandler", category: "music", score: 29 },
    { id: "3", name: "Show C", venue: "Only Hall", city: "Chandler", category: "music", score: 28 },
  ];

  const { selected } = selectEditorialSpread(candidates, {
    maxSlots: 3,
    getBaseScore: (item) => item.score,
    getItemKey: (item) => item.id,
    getVenueKey: (item) => item.venue,
    getGeographyKey: (item) => item.city,
    getCategoryKey: (item) => item.category,
    weights: LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  });

  assertEquals(selected.length, 3);
  assertEquals(selected.every((item) => item.venue === "Only Hall"), true);
});

Deno.test("selectEditorialSpread prefers geographic variety", () => {
  const chandler = Array.from({ length: 6 }, (_, i) => ({
    id: `ch-${i}`,
    name: `Chandler Event ${i}`,
    venue: `Venue ${i}`,
    city: "Chandler",
    category: `cat-${i}`,
    score: 30 - i,
  }));
  const others: TestCard[] = [
    { id: "mesa", name: "Mesa Fair", venue: "Mesa Park", city: "Mesa", category: "festival", score: 20 },
    { id: "gilbert", name: "Gilbert Night", venue: "Gilbert Hall", city: "Gilbert", category: "music", score: 19 },
    { id: "phoenix", name: "Phoenix Game", venue: "Chase Field", city: "Phoenix", category: "sports", score: 18 },
  ];

  const { selected } = selectEditorialSpread([...chandler, ...others], {
    maxSlots: 8,
    getBaseScore: (item) => item.score,
    getItemKey: (item) => item.id,
    getVenueKey: (item) => item.venue,
    getGeographyKey: (item) => item.city,
    getCategoryKey: (item) => item.category,
    weights: LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS,
  });

  const cities = new Set(selected.map((item) => item.city));
  assertEquals(cities.size >= 4, true);
  assertEquals(selected.filter((item) => item.city === "Chandler").length <= 4, true);
});

Deno.test("computeEditorialDiversityPenalty stacks category repeats softly", () => {
  const picked: TestCard[] = [
    { id: "1", name: "A", venue: "V1", city: "Mesa", category: "music", score: 10 },
    { id: "2", name: "B", venue: "V2", city: "Gilbert", category: "music", score: 9 },
  ];
  const candidate: TestCard = {
    id: "3",
    name: "C",
    venue: "V3",
    city: "Tempe",
    category: "music",
    score: 8,
  };

  const penalty = computeEditorialDiversityPenalty(
    candidate,
    picked,
    {
      getVenueKey: (item) => item.venue,
      getGeographyKey: (item) => item.city,
      getCategoryKey: (item) => item.category,
    },
    LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS
  );

  assertEquals(penalty, 2 * LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS.categoryRepeatPenalty);
});

Deno.test("isVenueEligibleForSpread blocks repeat when fresh venues can fill slots", () => {
  const picked: TestCard[] = [
    { id: "1", name: "A", venue: "Chase Field", city: "Phoenix", category: "sports", score: 30 },
  ];
  const unpicked: TestCard[] = [
    { id: "2", name: "B", venue: "Chase Field", city: "Phoenix", category: "sports", score: 29 },
    { id: "3", name: "C", venue: "Mesa Arts", city: "Mesa", category: "arts", score: 20 },
    { id: "4", name: "D", venue: "Tempe Improv", city: "Tempe", category: "comedy", score: 19 },
  ];

  assertEquals(
    isVenueEligibleForSpread(
      unpicked[0],
      picked,
      unpicked,
      2,
      { getVenueKey: (item) => item.venue },
      LOCAL_EVENTS_HOMEPAGE_DIVERSITY_WEIGHTS
    ),
    false
  );
});
