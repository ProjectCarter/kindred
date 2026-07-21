import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isDistinctLocalNewsArticleShape,
  isTitleOnlyCandidate,
  scoreLocalNewsSourceRichness,
} from "./localNewsSourceQuality.ts";
import {
  mergeNationalNewsState,
  resolveNationalNewsForCachedBundle,
  withSyncedNewsDesksInCache,
} from "./homepageNewsHydration.ts";
import type { NationalNewsPackage } from "./nationalNewsTypes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAMPLE_NATIONAL: NationalNewsPackage = {
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

test("richer candidate outranks title-only filler", () => {
  const rich = scoreLocalNewsSourceRichness({
    title: "Council approves park expansion after hours of debate",
    description:
      "Gilbert leaders voted Tuesday to expand Freestone Park with new trails and shade structures after neighbors testified.",
  });
  const thin = scoreLocalNewsSourceRichness({
    title: "Rockets sign veteran guard Smith",
    description: "Rockets sign veteran guard Smith",
  });
  assert.ok(rich.score > thin.score);
  assert.equal(isTitleOnlyCandidate({ title: "Rockets sign veteran guard Smith" }), true);
});

test("distinct local news article shape rejects headline clones", () => {
  assert.equal(
    isDistinctLocalNewsArticleShape({
      headline: "Rockets sign veteran guard Smith",
      dek: "Rockets sign veteran guard Smith",
      body: ["Rockets sign veteran guard Smith."],
    }),
    false
  );
  assert.equal(
    isDistinctLocalNewsArticleShape({
      headline: "Rockets sign veteran guard Smith",
      dek: "Houston adds a veteran guard, according to the wire report.",
      body: ["The Rockets signed veteran guard Smith, the team announced."],
    }),
    true
  );
});

test("article adapter does not inject emergency local news copy", () => {
  const articleSource = readFileSync(join(__dirname, "./article.ts"), "utf8");
  assert.doesNotMatch(
    articleSource,
    /The verified note on this story is brief\./
  );
});

test("legacy cache missing nationalNews hydrates from edition row", () => {
  const resolved = resolveNationalNewsForCachedBundle(
    {
      editionDate: "2026-07-19",
      topStories: [
        {
          id: "local-1",
          headline: "Council approves park expansion",
          summary: "Neighbors gathered for the vote.",
          source: "Local Paper",
          url: null,
          role: "local",
        },
      ],
    },
    { editionNationalNews: SAMPLE_NATIONAL }
  );
  assert.equal(resolved?.packageId, SAMPLE_NATIONAL.packageId);
});

test("all-local top_stories do not synthesize national news from cache", () => {
  assert.equal(
    resolveNationalNewsForCachedBundle({
      editionDate: "2026-07-19",
      topStories: [
        {
          id: "local-1",
          headline: "Council approves park expansion",
          summary: "Neighbors gathered for the vote.",
          source: "Local Paper",
          url: null,
          role: "local",
        },
      ],
    }),
    null
  );
});

test("mergeNationalNewsState never overwrites valid hydrated data with null", () => {
  assert.equal(
    mergeNationalNewsState(SAMPLE_NATIONAL, null)?.packageId,
    SAMPLE_NATIONAL.packageId
  );
  assert.equal(
    mergeNationalNewsState(null, SAMPLE_NATIONAL)?.packageId,
    SAMPLE_NATIONAL.packageId
  );
});

test("sync-after-cache backfill preserves nationalNews in cached bundle", () => {
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
    {
      topStories: [],
      nationalNews: SAMPLE_NATIONAL,
    }
  );
  assert.equal(bundle.nationalNews?.packageId, SAMPLE_NATIONAL.packageId);
});
