import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearAllHomeScrollSessions,
  getHomeScrollSync,
  homeScrollSessionKey,
  loadHomeScroll,
  resetHomeScrollSessionForTests,
  updateHomeScroll,
} from "./homeSession.ts";
import {
  resolveNationalNewsForRender,
  type NationalNewsPackage,
} from "./nationalNewsTypes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(join(__dirname, "../../app/home.tsx"), "utf8");

const SAMPLE_NATIONAL_NEWS: NationalNewsPackage = {
  packageId: "national-pkg-2026-07-19",
  editionDate: "2026-07-19",
  generatedAt: "2026-07-19T12:00:00.000Z",
  stories: [
    {
      id: "story-a",
      rank: 1,
      headline: "Federal Reserve holds rates steady",
      summary: "Central bankers signaled patience as inflation cools.",
      sourceName: "Reuters",
      sourceUrl: "https://example.com/a",
      publishedAt: "2026-07-19T08:00:00Z",
      category: "business",
      image: null,
      verification: {
        editorialScore: 72,
        reasons: ["Trusted source (Reuters)"],
        pool: "general",
      },
    },
  ],
};

const LOCAL_TOP_STORY = {
  id: "local-1",
  headline: "Council approves park expansion",
  summary: "Neighbors gathered for the vote.",
  source: "Local Paper",
  url: null,
  role: "local",
};

test.beforeEach(() => {
  resetHomeScrollSessionForTests();
});

test("warm-cache launch populates National News from network edition row", () => {
  const nationalNews = resolveNationalNewsForRender({
    edition: { national_news: SAMPLE_NATIONAL_NEWS },
    topStories: [LOCAL_TOP_STORY],
    editionDate: "2026-07-19",
  });

  assert.equal(nationalNews?.packageId, SAMPLE_NATIONAL_NEWS.packageId);
});

test("syncAfterCache && cacheMatchesNetwork path still hydrates National News", () => {
  assert.match(
    homeSource,
    /syncAfterCache && cacheMatchesNetwork[\s\S]*?resolveEditionNewsDesks\(/,
    "frozen cache/network match must call resolveEditionNewsDesks"
  );
  assert.match(
    homeSource,
    /withSyncedNewsDesksInCache\(/,
    "matched cache sync must persist nationalNews into cached bundle"
  );
  assert.match(
    homeSource,
    /applyCachedBundle[\s\S]*?resolveNationalNewsForCachedBundle\(/,
    "warm cache paint must hydrate nationalNews before network returns"
  );
  assert.match(
    homeSource,
    /nationalNews=\{nationalNews\}/,
    "EditionReader must receive nationalNews prop"
  );
});

test("article-return restores scroll position within the same session", async () => {
  const key = homeScrollSessionKey("edition-2026-07-19", "home|Gilbert|AZ");
  updateHomeScroll(key, 912);

  assert.equal(await loadHomeScroll(key), 912);
});

test("fresh process starts at scroll 0", async () => {
  const key = homeScrollSessionKey("edition-2026-07-19", "home|Gilbert|AZ");
  updateHomeScroll(key, 1200);
  clearAllHomeScrollSessions();

  assert.equal(getHomeScrollSync(key), 0);
  assert.equal(await loadHomeScroll(key), 0);
});

test("National News remains after warm cache sync and article-return session", async () => {
  const nationalNews = resolveNationalNewsForRender({
    edition: { national_news: SAMPLE_NATIONAL_NEWS },
    topStories: [LOCAL_TOP_STORY],
    editionDate: "2026-07-19",
  });
  assert.equal(nationalNews?.packageId, SAMPLE_NATIONAL_NEWS.packageId);

  const scrollKey = homeScrollSessionKey("edition-2026-07-19", "home|Gilbert|AZ");
  updateHomeScroll(scrollKey, 640);
  assert.equal(await loadHomeScroll(scrollKey), 640);
  assert.equal(nationalNews?.stories.length, 1);
});

test("legacy warm cache without nationalNews column resolves from network sync", () => {
  const nationalNews = resolveNationalNewsForRender({
    edition: { national_news: SAMPLE_NATIONAL_NEWS },
    topStories: [LOCAL_TOP_STORY],
    editionDate: "2026-07-19",
  });

  assert.equal(nationalNews?.stories[0]?.headline, SAMPLE_NATIONAL_NEWS.stories[0].headline);
});

test("National News collapses when no data exists", () => {
  assert.equal(
    resolveNationalNewsForRender({
      edition: {},
      topStories: [LOCAL_TOP_STORY],
      editionDate: "2026-07-19",
    }),
    null
  );
});
