import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveSportEventIcon,
  SPORT_EVENT_ICONS,
  SPORT_EVENT_ICON_FALLBACK,
} from "./sportEventIcon.ts";
import { resolveEventCategoryIcon } from "./categoryIcon.ts";

test("maps hometown baseball teams to ⚾ when sports market is known", () => {
  assert.equal(
    resolveSportEventIcon(
      {
        name: "Arizona Diamondbacks vs. St. Louis Cardinals",
        venue: "Chase Field",
        category: "sports",
      },
      { sportsMarketId: "phoenix-metro" }
    ),
    SPORT_EVENT_ICONS.baseball
  );
  assert.equal(
    resolveSportEventIcon(
      {
        name: "Seattle Mariners vs. Oakland Athletics",
        venue: "T-Mobile Park",
        category: "sports",
      },
      { sportsMarketId: "seattle-metro" }
    ),
    SPORT_EVENT_ICONS.baseball
  );
});

test("maps basketball teams to 🏀", () => {
  assert.equal(
    resolveSportEventIcon(
      {
        name: "Phoenix Mercury vs. Connecticut Sun",
        venue: "Mortgage Matchup Center",
        category: "sports",
      },
      { sportsMarketId: "phoenix-metro" }
    ),
    SPORT_EVENT_ICONS.basketball
  );
});

test("maps soccer teams to ⚽", () => {
  assert.equal(
    resolveSportEventIcon(
      {
        name: "Phoenix Rising FC vs Monterey Bay FC",
        venue: "Phoenix Rising Stadium",
        category: "sports",
      },
      { sportsMarketId: "phoenix-metro" }
    ),
    SPORT_EVENT_ICONS.soccer
  );
});

test("maps Arizona Cardinals to 🏈 not ⚾", () => {
  assert.equal(
    resolveSportEventIcon(
      {
        name: "Arizona Cardinals vs Seattle Seahawks",
        venue: "State Farm Stadium",
        category: "sports",
      },
      { sportsMarketId: "phoenix-metro" }
    ),
    SPORT_EVENT_ICONS.football
  );
});

test("uses ⛳ only for verified golf", () => {
  assert.equal(
    resolveSportEventIcon({
      name: "Charity Golf Classic",
      venue: "Desert Ridge",
      category: "sports",
    }),
    SPORT_EVENT_ICONS.golf
  );
  assert.notEqual(
    resolveSportEventIcon({
      name: "Youth Sports Day",
      venue: "Community Park",
      category: "sports",
    }),
    SPORT_EVENT_ICONS.golf
  );
});

test("falls back to 🏅 when sport is unknown", () => {
  assert.equal(
    resolveSportEventIcon({
      name: "Regional Athletic Showcase",
      venue: "Convention Center",
      category: "sports",
    }),
    SPORT_EVENT_ICON_FALLBACK
  );
});

test("wires sport icons through resolveEventCategoryIcon", () => {
  assert.equal(
    resolveEventCategoryIcon(
      {
        name: "Arizona Diamondbacks vs. St. Louis Cardinals",
        venue: "Chase Field",
        category: "sports",
      },
      { sportsMarketId: "phoenix-metro" }
    ),
    "⚾"
  );
});
