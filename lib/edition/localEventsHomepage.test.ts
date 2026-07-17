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
  return {
    date: "Jul 18, 2026",
    time: "7:00 PM",
    venue: "Test Venue",
    city: "Gilbert",
    sourceUrl: "https://example.com/tickets",
    sourceName: "Ticketmaster",
    editorialScore: 20,
    startDateIso: "2026-07-18",
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

  assert.equal(homepage.length, 8);
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
  assert.equal(homepage.length, 8);
  assert.equal(homepage.filter((e) => e.category === "music").length, 8);
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
