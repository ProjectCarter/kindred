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
import {
  mergeNationalNewsState,
  resolveEditionNewsDesks,
  resolveNationalNewsForCachedBundle,
  withSyncedNewsDesksInCache,
} from "./homepageNewsHydration.ts";

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
    /ensureNationalNewsHydrated\(/,
    "loadEdition must always ensure national news from edition row"
  );
  assert.match(
    homeSource,
    /\[home:nationalNews:reader\]/,
    "EditionReader nationalNews prop must be logged in dev"
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

test("resolveEditionNewsDesks falls back to legacy national top stories", () => {
  const desks = resolveEditionNewsDesks(
    { national_news: null, editorial_context: null },
    "2026-07-19"
  );
  assert.equal(desks.nationalNews, null);

  const withNational = resolveEditionNewsDesks(
    {
      national_news: null,
      editorial_context: {
        sections: [
          {
            sectionType: "top_stories",
            items: [
              {
                id: "nat-1",
                title: "Congress passes budget",
                summary: "Lawmakers reached a deal overnight.",
                source: "AP",
                role: "national",
              },
            ],
          },
        ],
      },
    },
    "2026-07-19"
  );
  assert.equal(withNational.nationalNews?.stories[0]?.headline, "Congress passes budget");
});

test("National News collapses when no data exists", () => {
  assert.equal(
    resolveNationalNewsForRender({
      edition: {},
      topStories: [LOCAL_TOP_STORY],
      editionDate: "2026-07-19",
      columnOnly: true,
    }),
    null
  );
});

test("homepage never synthesizes National News from top_stories alone", () => {
  assert.equal(
    resolveNationalNewsForRender({
      edition: {},
      topStories: [
        {
          id: "nat-1",
          headline: "National wire only",
          summary: "Should not become National News on homepage.",
          source: "AP",
          url: null,
          role: "national",
        },
      ],
      editionDate: "2026-07-19",
      columnOnly: true,
    }),
    null
  );
});

test("legacy cache without nationalNews hydrates from edition row", () => {
  const resolved = resolveNationalNewsForCachedBundle(
    {
      editionDate: "2026-07-19",
      topStories: [LOCAL_TOP_STORY],
    },
    { editionNationalNews: SAMPLE_NATIONAL_NEWS }
  );
  assert.equal(resolved?.packageId, SAMPLE_NATIONAL_NEWS.packageId);
});

test("all-local top_stories do not backfill national news from cache alone", () => {
  assert.equal(
    resolveNationalNewsForCachedBundle({
      editionDate: "2026-07-19",
      topStories: [LOCAL_TOP_STORY],
    }),
    null
  );
});

test("mergeNationalNewsState preserves valid hydrated national news", () => {
  assert.equal(
    mergeNationalNewsState(SAMPLE_NATIONAL_NEWS, null)?.packageId,
    SAMPLE_NATIONAL_NEWS.packageId
  );
});

test("withSyncedNewsDesksInCache backfills nationalNews", () => {
  const bundle = withSyncedNewsDesksInCache(
    {
      userId: "user-1",
      editionId: "edition-1",
      editionDate: "2026-07-19",
      metroKey: "phoenix-az",
      cachedAt: Date.now(),
      sections: [],
      leadStory: null,
      topStories: [],
      bandit: null,
      intelligence: null,
    },
    { topStories: [LOCAL_TOP_STORY], nationalNews: SAMPLE_NATIONAL_NEWS }
  );
  assert.equal(bundle.nationalNews?.packageId, SAMPLE_NATIONAL_NEWS.packageId);
});
