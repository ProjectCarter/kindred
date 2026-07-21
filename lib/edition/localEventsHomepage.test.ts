import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyLocalEventHomepageDesk,
  scoreEventForHomepageSelection,
  selectEditorialHomepageLocalEvents,
} from "./localEventsHomepage.ts";
import type { LocalEventCard } from "./localEvents.ts";

function card(
  overrides: Partial<LocalEventCard> & Pick<LocalEventCard, "name" | "category">
): LocalEventCard {
  const name = overrides.name;
  const venue = overrides.venue ?? "Test Venue";
  return {
    date: "Jul 18, 2026",
    time: "7:00 PM",
    venue,
    city: "Gilbert",
    sourceUrl: "https://example.com/tickets",
    sourceName: "Ticketmaster",
    editorialScore: 20,
    startDateIso: "2026-07-18",
    editorialHeadline: overrides.editorialHeadline ?? name,
    banditNote:
      overrides.banditNote ??
      `${name} at ${venue} is a verified evening plan with a clear start time.`,
    editorialBody: overrides.editorialBody ?? [
      `${name} brings a verified schedule to ${venue} on the metro calendar.`,
      "Doors and start times are listed on the official event page.",
      "The venue address and ticket link are confirmed before publication.",
    ],
    ...overrides,
  };
}

test("maps categories to editorial desks", () => {
  assert.equal(classifyLocalEventHomepageDesk(card({ name: "D-backs", category: "sports" })), "sports");
  assert.equal(
    classifyLocalEventHomepageDesk(card({ name: "Ella Mai Tour", category: "music" })),
    "music"
  );
  assert.equal(
    classifyLocalEventHomepageDesk(card({ name: "Mesa Night Market", category: "food" })),
    "festival_fair"
  );
  assert.equal(
    classifyLocalEventHomepageDesk(card({ name: "Jo Koy Live", category: "comedy" })),
    "arts_theater_comedy"
  );
  assert.equal(
    classifyLocalEventHomepageDesk(card({ name: "Town cleanup", category: "community" })),
    "community"
  );
});

test("homepage selection balances sports with high-scoring concerts", () => {
  const concerts = Array.from({ length: 12 }, (_, i) =>
    card({
      name: `Headliner Concert ${i + 1}`,
      category: "music",
      venue: `Venue ${i + 1}`,
      editorialScore: 30 - i,
      date: `Jul ${18 + i}, 2026`,
      startDateIso: `2026-07-${String(18 + i).padStart(2, "0")}`,
    })
  );
  const sports = [
    card({
      name: "Arizona Diamondbacks vs. St. Louis Cardinals",
      category: "sports",
      venue: "Chase Field",
      editorialScore: 22,
    }),
    card({
      name: "Phoenix Mercury vs. Connecticut Sun",
      category: "sports",
      venue: "Mortgage Matchup Center",
      editorialScore: 21,
    }),
    card({
      name: "Phoenix Rising FC vs Monterey Bay FC",
      category: "sports",
      venue: "Phoenix Rising Stadium",
      editorialScore: 20,
    }),
  ];

  const { homepage } = selectEditorialHomepageLocalEvents([...concerts, ...sports], {
    maxTotal: 8,
    reference: new Date("2026-07-17T12:00:00-07:00"),
    sportsMarketId: "phoenix-metro",
  });

  assert.ok(homepage.length >= 4, `expected at least 4 homepage cards, got ${homepage.length}`);
  const sportsCount = homepage.filter((e) => e.category === "sports").length;
  const musicCount = homepage.filter((e) => e.category === "music").length;
  assert.ok(sportsCount >= 2, `expected at least 2 sports, got ${sportsCount}`);
  assert.ok(musicCount >= 2, `expected at least 2 music, got ${musicCount}`);
  assert.ok(homepage.some((e) => e.name.includes("Diamondbacks")));
});

test("homepage selection flexes when a desk has no quality events", () => {
  const onlyMusic = Array.from({ length: 10 }, (_, i) =>
    card({
      name: `Concert ${i + 1}`,
      category: "music",
      venue: `Hall ${i + 1}`,
      editorialScore: 25 - i,
      date: `Jul ${18 + i}, 2026`,
      startDateIso: `2026-07-${String(18 + i).padStart(2, "0")}`,
    })
  );

  const { homepage } = selectEditorialHomepageLocalEvents(onlyMusic, { maxTotal: 8 });
  assert.equal(homepage.length, 2);
  assert.equal(homepage.filter((e) => e.category === "music").length, 2);
});

test("homepage avoids stacking similar listings from the same venue", () => {
  const games = [
    card({
      name: "Arizona Diamondbacks vs. St. Louis Cardinals",
      category: "sports",
      venue: "Chase Field",
      editorialScore: 24,
      date: "Jul 17, 2026",
      startDateIso: "2026-07-17",
    }),
    card({
      name: "Arizona Diamondbacks vs. St. Louis Cardinals",
      category: "sports",
      venue: "Chase Field",
      editorialScore: 23,
      date: "Jul 18, 2026",
      startDateIso: "2026-07-18",
    }),
    card({
      name: "Phoenix Mercury vs. Connecticut Sun",
      category: "sports",
      venue: "Mortgage Matchup Center",
      editorialScore: 22,
    }),
  ];

  const { homepage } = selectEditorialHomepageLocalEvents(games, { maxTotal: 2 });
  assert.equal(homepage.length, 2);
  assert.equal(homepage.filter((e) => e.venue === "Chase Field").length, 1);
});

test("prioritizes major teams within the sports desk without dominating the page", () => {
  const reference = new Date("2026-07-17T12:00:00-07:00");
  const dbacks = card({
    name: "Arizona Diamondbacks vs. St. Louis Cardinals",
    category: "sports",
    venue: "Chase Field",
    editorialScore: 20,
  });
  const minorLeague = card({
    name: "Regional Athletic Showcase",
    category: "sports",
    venue: "Community Field",
    editorialScore: 21,
  });

  assert.ok(
    scoreEventForHomepageSelection(dbacks, reference, { sportsMarketId: "phoenix-metro" }) >
      scoreEventForHomepageSelection(minorLeague, reference, { sportsMarketId: "phoenix-metro" })
  );
});

test("homepage spreads geography across the valley when alternatives exist", () => {
  const chandlerStack = Array.from({ length: 6 }, (_, i) =>
    card({
      name: `Chandler Concert ${i + 1}`,
      category: "music",
      venue: `Chandler Venue ${i + 1}`,
      city: "Chandler",
      editorialScore: 28 - i,
      date: `Jul ${18 + i}, 2026`,
      startDateIso: `2026-07-${String(18 + i).padStart(2, "0")}`,
    })
  );
  const valley = [
    card({ name: "Mesa Night Market", category: "food", venue: "Mesa Park", city: "Mesa", editorialScore: 22 }),
    card({ name: "Gilbert Art Walk", category: "arts", venue: "Heritage District", city: "Gilbert", editorialScore: 21 }),
    card({ name: "Tempe Comedy Night", category: "comedy", venue: "Tempe Improv", city: "Tempe", editorialScore: 20 }),
    card({ name: "Scottsdale Jazz", category: "music", venue: "Western Spirit", city: "Scottsdale", editorialScore: 19 }),
    card({
      name: "Arizona Diamondbacks vs. St. Louis Cardinals",
      category: "sports",
      venue: "Chase Field",
      city: "Phoenix",
      editorialScore: 24,
    }),
  ];

  const { homepage } = selectEditorialHomepageLocalEvents([...chandlerStack, ...valley], {
    maxTotal: 8,
    reference: new Date("2026-07-17T12:00:00-07:00"),
    sportsMarketId: "phoenix-metro",
  });

  assert.ok(homepage.length >= 6, `expected at least 6 homepage cards, got ${homepage.length}`);
  const chandlerCount = homepage.filter((e) => e.city === "Chandler").length;
  assert.ok(chandlerCount <= 4, `expected at most 4 Chandler picks, got ${chandlerCount}`);
  assert.ok(new Set(homepage.map((e) => e.city)).size >= 4);
});

test("homepage keeps the strongest event at a venue even when the venue repeats later in the edition pool", () => {
  const chaseField = [
    card({
      name: "Arizona Diamondbacks vs. St. Louis Cardinals",
      category: "sports",
      venue: "Chase Field",
      city: "Phoenix",
      editorialScore: 30,
      date: "Jul 17, 2026",
      startDateIso: "2026-07-17",
    }),
    card({
      name: "Arizona Diamondbacks vs. San Diego Padres",
      category: "sports",
      venue: "Chase Field",
      city: "Phoenix",
      editorialScore: 28,
      date: "Jul 18, 2026",
      startDateIso: "2026-07-18",
    }),
  ];
  const others = Array.from({ length: 8 }, (_, i) =>
    card({
      name: `Valley Event ${i + 1}`,
      category: i % 2 === 0 ? "music" : "community",
      venue: `Venue ${i + 1}`,
      city: ["Mesa", "Gilbert", "Tempe", "Scottsdale"][i % 4],
      editorialScore: 20 - i,
      date: `Jul ${20 + i}, 2026`,
      startDateIso: `2026-07-${String(20 + i).padStart(2, "0")}`,
    })
  );

  const { homepage } = selectEditorialHomepageLocalEvents([...chaseField, ...others], {
    maxTotal: 8,
    reference: new Date("2026-07-17T12:00:00-07:00"),
    sportsMarketId: "phoenix-metro",
  });

  assert.equal(homepage.filter((e) => e.venue === "Chase Field").length, 1);
  assert.ok(homepage.some((e) => e.name.includes("Cardinals")));
});
