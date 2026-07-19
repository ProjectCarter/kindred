/**
 * Regression: with Bandit's Picks disabled for V1, a ready edition must
 * load successfully regardless of missing / null / empty / malformed bandit.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { banditsPick, parseBanditPayload } from "./bandit.ts";
import { isBanditsPicksEnabled } from "./banditsPicksFeature.ts";
import { isPersistedEditionComplete } from "../perf/coldLaunchTrace.ts";
import { assessEditionCompleteness } from "../perf/editionCompleteness.ts";
import type { EditionSection } from "./types.ts";
import type { RankedDiscoveryItem } from "./discovery.ts";

function ranked(
  id: string,
  category: RankedDiscoveryItem["item"]["category"],
  score = 80
): RankedDiscoveryItem {
  return {
    score,
    item: {
      id,
      title: `Place ${id}`,
      dek: "A calm neighborhood spot worth a visit.",
      category,
      family: "food_drink",
      tags: [],
      source: { name: "Verified Source", tier: "local" },
      url: "https://example.com",
      venueCategories: category === "activities" ? ["Escape Room"] : [],
      lat: 33.35,
      lon: -111.79,
      seasons: [],
      weatherFit: [],
      popularity: 0,
      uniqueness: 0,
      reasons: [],
      editorialConfidence: {
        score: 92,
        action: "publish",
        signals: [],
        completeness: true,
        verified: true,
        scoredAt: "2026-07-18T12:00:00.000Z",
      },
    } as unknown as RankedDiscoveryItem["item"],
    reasons: [],
  } as unknown as RankedDiscoveryItem;
}

const DISCOVERY = {
  version: 1 as const,
  generatedAt: "2026-07-18T12:00:00.000Z",
  editionDate: "2026-07-18",
  location: {
    city: "Gilbert",
    region: "AZ",
    state: "AZ",
    lat: 33.35,
    lon: -111.79,
  },
  surfaces: {
    activities: {
      surface: "activities" as const,
      headline: "Activities",
      editorNote: "",
      items: [ranked("act1", "activities")],
    },
    coffee: {
      surface: "coffee" as const,
      headline: "Coffee",
      editorNote: "",
      items: [ranked("cof1", "coffee")],
    },
  },
  picks: [],
  editorBrief: "",
  selectionMeta: {
    candidateCount: 2,
    selectedCount: 2,
    editorNotes: [] as string[],
    enrichQueue: [] as never[],
  },
};

const BASE_SECTIONS: EditionSection[] = [
  {
    id: "s-events",
    edition_id: "ed-1",
    section_type: "local_events",
    position: 0,
    headline: "Local Events",
    body: JSON.stringify({
      events: [
        {
          name: "Farmers Market",
          venue: "Freestone Park",
          city: "Gilbert",
        },
      ],
    }),
    source_note: null,
  },
  {
    id: "s-history",
    edition_id: "ed-1",
    section_type: "today_in_history",
    position: 1,
    headline: "1914 — A Day Worth Remembering",
    body: "History body.",
    source_note: null,
  },
  {
    id: "s-story",
    edition_id: "ed-1",
    section_type: "story_of",
    position: 2,
    headline: "The Story of Gilbert",
    body: "City story.",
    source_note: null,
  },
  {
    id: "s-food",
    edition_id: "ed-1",
    section_type: "food_drinks",
    position: 3,
    headline: "Food & Drinks",
    body: "[]",
    source_note: null,
  },
];

const BANDIT_CASES: Array<{ label: string; bandit: unknown }> = [
  { label: "no bandit field", bandit: undefined },
  { label: "bandit: null", bandit: null },
  { label: "empty Bandit array", bandit: [] },
  {
    label: "malformed object",
    bandit: { version: 1, pick: { story: null }, morning: "not-an-object" },
  },
  {
    label: "pick without story",
    bandit: {
      version: 1,
      morning: { line: "Good morning." },
      pick: { kind: "article", intro: "Try this." },
    },
  },
  { label: "string payload", bandit: "not-json" },
  {
    label: "pick as array (banditsPick[0] shape)",
    bandit: {
      version: 1,
      morning: { line: "Good morning." },
      pick: [
        {
          headline: "Array element",
          title: "Legacy title",
          heroImage: "https://example.com/x.jpg",
        },
      ],
    },
  },
];

function assertBanditNeverBlocks(bandit: unknown, label: string) {
  assert.equal(
    isBanditsPicksEnabled(),
    false,
    "test expects Bandit's Picks V1 gate disabled"
  );

  assert.doesNotThrow(() => {
    assert.equal(
      banditsPick(bandit as never),
      null,
      `${label}: banditsPick() must return null while disabled`
    );
  }, `${label}: banditsPick must not throw`);

  assert.doesNotThrow(() => parseBanditPayload(bandit), `${label}: parse`);

  const persisted = isPersistedEditionComplete(
    {
      discovery: DISCOVERY,
      lead_story: {
        role: "local",
        headline: "Local lead",
        summary: "Summary",
      },
      bandit,
      morning_edition: {
        morningHero: { hostedUrl: "https://example.com/art.jpg" },
      },
    },
    BASE_SECTIONS,
    { expectStoryOf: true }
  );

  assert.equal(
    persisted.reasons.includes("editions.bandit has no pick"),
    false,
    `${label}: persisted completeness must not cite missing bandit`
  );
  assert.equal(
    persisted.complete,
    true,
    `${label}: persisted edition must be complete without bandit — reasons: ${persisted.reasons.join("; ")}`
  );

  const assessed = assessEditionCompleteness({
    sections: BASE_SECTIONS,
    intelligence: {
      discovery: DISCOVERY as never,
      discoveryItems: null,
      morningHero: { hostedUrl: "https://example.com/art.jpg" } as never,
    } as never,
    bandit: parseBanditPayload(bandit),
    leadStory: {
      role: "local",
      headline: "Local lead",
      summary: "Summary",
    } as never,
    readerLocation: { lat: 33.35, lon: -111.79 },
    expectStoryOf: true,
  });

  assert.equal(
    assessed.missing.includes("bandits_pick"),
    false,
    `${label}: assessEditionCompleteness must not list bandits_pick`
  );
  assert.equal(
    assessed.complete,
    true,
    `${label}: assessEditionCompleteness must pass — missing: ${assessed.missing.join("; ")}`
  );
}

describe("Bandit's Picks V1 disabled — edition still loads", () => {
  for (const { label, bandit } of BANDIT_CASES) {
    it(`loads with ${label}`, () => {
      assertBanditNeverBlocks(bandit, label);
    });
  }
});
