import test from "node:test";
import assert from "node:assert/strict";
import {
  isMajorLocalTeamEvent,
  resolveMajorLocalTeamHomepageBoost,
  MAJOR_LOCAL_TEAM_HOMEPAGE_BOOST,
} from "./majorLocalTeams.ts";
import { scoreEventForHomepageSelection } from "./localEventsHomepage.ts";
import type { LocalEventCard } from "./localEvents.ts";

function sportsCard(
  overrides: Partial<LocalEventCard> & Pick<LocalEventCard, "name">
): LocalEventCard {
  return {
    date: "Jul 18, 2026",
    time: "7:00 PM",
    venue: "Chase Field",
    city: "Phoenix",
    sourceUrl: "https://example.com/tickets",
    sourceName: "Ticketmaster",
    category: "sports",
    editorialScore: 20,
    startDateIso: "2026-07-18",
    ...overrides,
  };
}

test("boosts hometown pro teams for the edition sports market", () => {
  assert.equal(
    resolveMajorLocalTeamHomepageBoost(
      sportsCard({ name: "Arizona Diamondbacks vs. St. Louis Cardinals" }),
      "phoenix-metro"
    ),
    MAJOR_LOCAL_TEAM_HOMEPAGE_BOOST.pro
  );
  assert.equal(
    resolveMajorLocalTeamHomepageBoost(
      sportsCard({ name: "Seattle Mariners vs. Oakland Athletics", venue: "T-Mobile Park" }),
      "seattle-metro"
    ),
    MAJOR_LOCAL_TEAM_HOMEPAGE_BOOST.pro
  );
});

test("does not boost teams outside the edition sports market", () => {
  assert.equal(
    resolveMajorLocalTeamHomepageBoost(
      sportsCard({ name: "Arizona Diamondbacks vs. St. Louis Cardinals" }),
      "seattle-metro"
    ),
    0
  );
});

test("does not boost non-sports listings", () => {
  assert.equal(
    resolveMajorLocalTeamHomepageBoost(
      {
        name: "Arizona Diamondbacks Fan Fest",
        venue: "Chase Field",
        category: "community",
      },
      "phoenix-metro"
    ),
    0
  );
});

test("boosts spring training without hard-pinning above concerts", () => {
  const springTraining = sportsCard({
    name: "Spring Training: San Francisco Giants vs Chicago Cubs",
    venue: "Scottsdale Stadium",
    editorialScore: 18,
  });
  const concert = {
    ...sportsCard({ name: "Headliner Concert", category: "music" as const }),
    editorialScore: 30,
  };

  const reference = new Date("2026-07-17T12:00:00-07:00");
  const boostedSports = scoreEventForHomepageSelection(springTraining, reference, {
    sportsMarketId: "phoenix-metro",
  });
  const concertScore = scoreEventForHomepageSelection(concert, reference, {
    sportsMarketId: "phoenix-metro",
  });

  assert.equal(isMajorLocalTeamEvent(springTraining, "phoenix-metro"), true);
  assert.ok(boostedSports < concertScore);
});
