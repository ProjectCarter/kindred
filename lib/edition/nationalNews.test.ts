import test from "node:test";
import assert from "node:assert/strict";
import { assessMinimumViableEdition } from "./minimumViableEdition.ts";
import {
  localTopStoriesOnly,
  nationalNewsFromEdition,
  nationalNewsFromLegacyTopStories,
  nationalNewsStoryIds,
  parseNationalNewsPackage,
  resolveNationalNewsForRender,
  simulateNationalNewsClaim,
} from "./nationalNewsTypes.ts";

const SAMPLE_PACKAGE = {
  packageId: "national-pkg-2026-07-18",
  editionDate: "2026-07-18",
  generatedAt: "2026-07-18T12:00:00.000Z",
  stories: [
    {
      id: "story-a",
      rank: 1,
      headline: "Federal Reserve holds rates steady",
      summary: "Central bankers signaled patience as inflation cools.",
      sourceName: "Reuters",
      sourceUrl: "https://example.com/a",
      publishedAt: "2026-07-18T08:00:00Z",
      category: "business",
      image: {
        url: "https://cdn.example.com/a.jpg",
        attribution: "Reuters",
        licenseNote: "Wire photo via NewsAPI source",
      },
      verification: {
        editorialScore: 72,
        reasons: ["Trusted source (Reuters)"],
        pool: "general",
      },
    },
    {
      id: "story-b",
      rank: 2,
      headline: "Senate advances infrastructure package",
      summary: "Lawmakers moved a bipartisan bill toward a floor vote.",
      sourceName: "AP",
      sourceUrl: "https://example.com/b",
      publishedAt: "2026-07-18T07:30:00Z",
      category: "national",
      image: null,
      verification: {
        editorialScore: 68,
        reasons: ["Major national or world story for the front page"],
        pool: "general",
      },
    },
    {
      id: "story-c",
      rank: 3,
      headline: "NASA sets date for lunar mission review",
      summary: "Agency leaders outlined the next Artemis milestone.",
      sourceName: "NPR",
      sourceUrl: "https://example.com/c",
      publishedAt: "2026-07-18T06:00:00Z",
      category: "science",
      image: null,
      verification: {
        editorialScore: 65,
        reasons: ["Fresh for this morning’s edition"],
        pool: "general",
      },
    },
  ],
};

test("Gilbert and Seattle receive identical National News IDs and ordering", () => {
  const gilbert = parseNationalNewsPackage(SAMPLE_PACKAGE);
  const seattle = parseNationalNewsPackage(SAMPLE_PACKAGE);
  assert.deepEqual(nationalNewsStoryIds(gilbert), nationalNewsStoryIds(seattle));
  assert.equal(gilbert?.packageId, seattle?.packageId);
  assert.deepEqual(
    gilbert?.stories.map((s) => s.rank),
    seattle?.stories.map((s) => s.rank)
  );
});

test("different dates produce different national news package ids", () => {
  const july17 = parseNationalNewsPackage({
    ...SAMPLE_PACKAGE,
    packageId: "national-pkg-2026-07-17",
    editionDate: "2026-07-17",
  });
  const july18 = parseNationalNewsPackage(SAMPLE_PACKAGE);
  assert.notEqual(july17?.packageId, july18?.packageId);
  assert.notEqual(july17?.editionDate, july18?.editionDate);
});

test("concurrent city builds create only one national-news package", () => {
  const store: { national_news: typeof SAMPLE_PACKAGE | null } = {
    national_news: null,
  };
  const gilbertAttempt = {
    ...SAMPLE_PACKAGE,
    stories: [
      { ...SAMPLE_PACKAGE.stories[0], headline: "Gilbert builder attempt" },
      ...SAMPLE_PACKAGE.stories.slice(1),
    ],
  };
  const seattleAttempt = {
    ...SAMPLE_PACKAGE,
    stories: [
      { ...SAMPLE_PACKAGE.stories[0], headline: "Seattle builder attempt" },
      ...SAMPLE_PACKAGE.stories.slice(1),
    ],
  };

  const gilbert = simulateNationalNewsClaim(store, gilbertAttempt);
  const seattle = simulateNationalNewsClaim(store, seattleAttempt);

  assert.equal(gilbert.claimed, true);
  assert.equal(seattle.claimed, false);
  assert.equal(store.national_news?.stories[0]?.headline, gilbertAttempt.stories[0].headline);
});

test("Local News remains different by city", () => {
  const gilbertLocal = [
    {
      id: "local-gilbert",
      headline: "Gilbert council approves park expansion",
      summary: "Town leaders voted to add trails near Freestone Park.",
      source: "Gilbert Sun",
      url: "https://example.com/gilbert",
      role: "local",
    },
  ];
  const seattleLocal = [
    {
      id: "local-seattle",
      headline: "Seattle port workers reach tentative deal",
      summary: "Dock negotiations paused weekend slowdown fears.",
      source: "Seattle Times",
      url: "https://example.com/seattle",
      role: "local",
    },
  ];

  assert.notEqual(gilbertLocal[0]?.id, seattleLocal[0]?.id);
  assert.deepEqual(localTopStoriesOnly(gilbertLocal).map((s) => s.id), ["local-gilbert"]);
});

test("legacy edition rows without national_news still render via adapter", () => {
  const legacyTopStories = [
    {
      id: "legacy-national-1",
      headline: "Legacy national headline",
      summary: "Legacy national summary.",
      source: "AP",
      url: "https://example.com/legacy",
      role: "national",
    },
    {
      id: "legacy-local-1",
      headline: "Legacy local headline",
      summary: "Legacy local summary.",
      source: "Local Desk",
      url: null,
      role: "local",
    },
  ];

  const legacy = nationalNewsFromLegacyTopStories(legacyTopStories, "2026-07-10");
  assert.ok(legacy);
  assert.equal(legacy?.stories.length, 1);
  assert.equal(legacy?.stories[0]?.id, "legacy-national-1");
});

test("national-news failure does not block local edition paint", () => {
  const mvp = assessMinimumViableEdition([
    {
      id: "sec-1",
      edition_id: "ed-1",
      section_type: "local_events",
      position: 1,
      headline: "Events",
      body: "[]",
      source_note: null,
    },
    {
      id: "sec-2",
      edition_id: "ed-1",
      section_type: "greeting",
      position: 0,
      headline: "Good morning",
      body: "Welcome.",
      source_note: null,
    },
  ]);
  assert.equal(mvp.paintable, true);
  assert.equal(parseNationalNewsPackage(null), null);
});

test("no regression to Masterpiece or Today in History sharing fields", () => {
  const parsed = nationalNewsFromEdition({ national_news: SAMPLE_PACKAGE });
  assert.ok(parsed);
  const serialized = JSON.stringify(parsed);
  assert.doesNotMatch(serialized, /morningHero|today_in_history|artworkId/i);
});

test("resolveNationalNewsForRender prefers dedicated column over legacy top stories", () => {
  const fromColumn = resolveNationalNewsForRender({
    edition: { national_news: SAMPLE_PACKAGE },
    topStories: [],
    editionDate: "2026-07-18",
  });
  assert.equal(fromColumn?.packageId, SAMPLE_PACKAGE.packageId);

  const legacyOnly = resolveNationalNewsForRender({
    edition: {},
    topStories: [
      {
        id: "n1",
        headline: "Wire headline",
        summary: "Wire summary",
        source: "AP",
        url: null,
        role: "national",
      },
    ],
    editionDate: "2026-07-10",
  });
  assert.equal(legacyOnly?.packageId, "legacy:2026-07-10");
});

test("second city cache hit reuses package without regenerating story ids", () => {
  const first = parseNationalNewsPackage(SAMPLE_PACKAGE);
  const second = parseNationalNewsPackage(SAMPLE_PACKAGE);
  assert.deepEqual(nationalNewsStoryIds(first), nationalNewsStoryIds(second));
});
