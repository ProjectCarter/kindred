import test from "node:test";
import assert from "node:assert/strict";
import type { LocalEventCard } from "./localEvents.ts";
import {
  assessLocalEventHomepageEditorial,
  filterLocalEventsForHomepageCuration,
  isPlaceholderLocalEventListing,
  passesKindredTestForHomepage,
} from "./localEventsHomepageEditorial.ts";
import { selectEditorialHomepageLocalEvents } from "./localEventsHomepage.ts";

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
    sourceName: "Eventbrite",
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

test("flags placeholder and business promotion listings", () => {
  assert.equal(isPlaceholderLocalEventListing({ name: "Sports", venue: "Ocotillo Golf Club" }), true);
  assert.equal(
    passesKindredTestForHomepage(
      card({
        name: "Creative Events Concept: 1 Day Ideation Session",
        category: "community",
        venue: "regus AZ, Phoenix - 24th and Camelback",
      })
    ),
    false
  );
  assert.equal(
    passesKindredTestForHomepage(
      card({
        name: "Marketing and Sales for Event Planner: 1 Day Course in Phoenix, AZ",
        category: "community",
        venue: "Office Workshop",
      })
    ),
    false
  );
});

test("allows memorable public experiences through The Kindred Test", () => {
  assert.equal(
    passesKindredTestForHomepage(
      card({ name: "Mesa Night Market — Asian Food Festival", category: "market", venue: "Mesa Night Market", city: "Mesa" })
    ),
    true
  );
  assert.equal(
    passesKindredTestForHomepage(
      card({ name: "CHANDLER GHOST WALK", category: "community", venue: "Mic Drop Comedy", city: "Chandler" })
    ),
    true
  );
  assert.equal(
    passesKindredTestForHomepage(
      card({
        name: "Drawing Workshop With M.A.R.C.U.S. Art",
        category: "arts",
        venue: "Phoenix Center for the Arts",
        city: "Phoenix",
      })
    ),
    true
  );
  assert.equal(
    passesKindredTestForHomepage(
      card({
        name: "Arizona Diamondbacks vs. St. Louis Cardinals",
        category: "sports",
        venue: "Chase Field",
        editorialScore: 24,
      })
    ),
    true
  );
});

test("homepage curator removes low-value events before ranking", () => {
  const pool = [
    card({ name: "Joannah Zamora at The Casual Pint of Ocotillo", category: "music", venue: "The Casual Pint of Ocotillo", city: "Chandler", editorialScore: 26 }),
    card({ name: "CHANDLER GHOST WALK", category: "community", venue: "Mic Drop Comedy", city: "Chandler", editorialScore: 24 }),
    card({ name: "Mesa Night Market — Asian Food Festival", category: "market", venue: "Mesa Night Market", city: "Mesa", editorialScore: 25 }),
    card({
      name: "Creative Events Concept: 1 Day Ideation Session",
      category: "community",
      venue: "regus AZ, Phoenix",
      editorialScore: 30,
    }),
    card({ name: "Sports", category: "sports", venue: "Ocotillo Golf Club", editorialScore: 29 }),
    card({
      name: "Drawing Workshop With M.A.R.C.U.S. Art",
      category: "arts",
      venue: "Phoenix Center for the Arts",
      city: "Phoenix",
      editorialScore: 22,
    }),
  ];

  const eligible = filterLocalEventsForHomepageCuration(pool);
  assert.equal(eligible.length, 4);
  assert.ok(!eligible.some((event) => /creative events concept/i.test(event.name)));
  assert.ok(!eligible.some((event) => event.name === "Sports"));

  const { homepage } = selectEditorialHomepageLocalEvents(eligible, {
    maxTotal: 8,
    reference: new Date("2026-07-17T12:00:00-07:00"),
  });
  assert.ok(homepage.length >= 4);
  assert.ok(homepage.some((event) => /night market/i.test(event.name)));
  assert.ok(homepage.some((event) => /ghost walk/i.test(event.name)));
});

test("memorable experiences receive editorial ranking boost", () => {
  const generic = assessLocalEventHomepageEditorial(
    card({ name: "Community Meetup", category: "community", venue: "Community Hall" })
  );
  const festival = assessLocalEventHomepageEditorial(
    card({ name: "Mesa Night Market — Asian Food Festival", category: "market", venue: "Mesa Night Market" })
  );
  assert.equal(generic.eligible, false);
  assert.ok(festival.memorableBoost > generic.memorableBoost);
});
