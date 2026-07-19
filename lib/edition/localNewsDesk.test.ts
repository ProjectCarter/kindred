/**
 * Local News desk priority — Node smoke tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_NEWS_CONTENT_TYPE_BADGE,
  buildStateSportsNewsQuery,
  classifyLocalNewsContentType,
  selectLocalNewsDeskLead,
} from "./localNewsDesk.ts";

const NOW = new Date("2026-07-18T15:00:00.000Z");
const PLACE = {
  city: "Gilbert",
  state: "AZ",
  region: "AZ",
  metroKey: "phoenix-az",
};

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

test("badges match editorial labels", () => {
  assert.equal(LOCAL_NEWS_CONTENT_TYPE_BADGE.local_news, "📰 Local News");
  assert.equal(LOCAL_NEWS_CONTENT_TYPE_BADGE.sports, "🏈 Sports");
  assert.equal(LOCAL_NEWS_CONTENT_TYPE_BADGE.weather, "🌤 Weather");
  assert.equal(LOCAL_NEWS_CONTENT_TYPE_BADGE.community, "🏛 Community Update");
});

test("classifies arizona sports for gilbert", () => {
  assert.equal(
    classifyLocalNewsContentType(
      {
        title: "Arizona Diamondbacks clinch series win",
        description: "The Diamondbacks beat the Dodgers.",
        source: "Arizona Sports",
      },
      PLACE
    ),
    "sports"
  );
});

test("classifies weather and community desks", () => {
  assert.equal(
    classifyLocalNewsContentType({
      title: "Heat advisory issued for Phoenix metro",
      description: "NWS warns of dangerous temperatures.",
      source: "Weather Service",
    }),
    "weather"
  );
  assert.equal(
    classifyLocalNewsContentType({
      title: "Gilbert road closures begin Monday",
      description: "City announces construction detours.",
      source: "Town of Gilbert",
    }),
    "community"
  );
});

test("prefers fresh local news over older sports", () => {
  const pick = selectLocalNewsDeskLead(
    [
      {
        id: "sports-oldish",
        title: "Phoenix Suns win thriller",
        description: "Deandre Ayton scores 30.",
        publishedAt: hoursAgo(10),
        source: "Arizona Sports",
        url: "https://example.com/suns",
        score: 90,
      },
      {
        id: "local-fresh",
        title: "Gilbert water rates under review after summer surge",
        description: "Residents fill a hearing room to ask about bills.",
        publishedAt: hoursAgo(6),
        source: "East Valley Tribune",
        url: "https://example.com/water",
        score: 40,
      },
    ],
    {
      now: NOW,
      recentStoryKeys: [],
      minScore: 0,
      place: PLACE,
      isRecentCoverage: () => false,
    }
  );
  assert.equal(pick?.contentType, "local_news");
  assert.equal(pick?.candidate.id, "local-fresh");
});

test("falls back to state sports when no fresh local news", () => {
  const pick = selectLocalNewsDeskLead(
    [
      {
        id: "stale-local",
        title: "Gilbert shop opens new location",
        description: "A local business story from last week.",
        publishedAt: hoursAgo(48),
        source: "East Valley Tribune",
        url: "https://example.com/shop",
        score: 80,
      },
      {
        id: "az-sports",
        title: "Arizona Cardinals prepare for opener",
        description: "Training camp notes from Glendale.",
        publishedAt: hoursAgo(8),
        source: "Arizona Sports",
        url: "https://example.com/cards",
        category: "sports",
        score: 35,
      },
    ],
    {
      now: NOW,
      recentStoryKeys: [],
      minScore: 0,
      place: PLACE,
      isRecentCoverage: () => false,
    }
  );
  assert.equal(pick?.contentType, "sports");
  assert.equal(pick?.candidate.id, "az-sports");
});

test("never reuses yesterday's story id", () => {
  const pick = selectLocalNewsDeskLead(
    [
      {
        id: "yesterdays-lead",
        title: "Arizona Diamondbacks walk off win",
        description: "A thrilling finish in Phoenix.",
        publishedAt: hoursAgo(5),
        source: "Arizona Sports",
        url: "https://example.com/dbacks",
        category: "sports",
        score: 70,
      },
    ],
    {
      now: NOW,
      recentStoryKeys: ["yesterdays-lead"],
      minScore: 0,
      place: PLACE,
      isRecentCoverage: (c, keys) => keys.includes(c.id),
    }
  );
  assert.equal(pick, null);
});

test("blocks press releases older than 24 hours as lead", () => {
  const pick = selectLocalNewsDeskLead(
    [
      {
        id: "old-pr",
        title: "HelloNation Highlights How Care Helps",
        description: "A syndicated release.",
        publishedAt: hoursAgo(40),
        source: "PRNewswire",
        url: "https://www.prnewswire.com/news-releases/a.html",
        score: 90,
      },
    ],
    {
      now: NOW,
      recentStoryKeys: [],
      minScore: 0,
      place: PLACE,
      isRecentCoverage: () => false,
    }
  );
  assert.equal(pick, null);
});

test("sports query includes arizona pro teams", () => {
  const q = buildStateSportsNewsQuery(PLACE);
  assert.ok(q);
  assert.match(q!, /Diamondbacks|Suns|Cardinals/i);
});
