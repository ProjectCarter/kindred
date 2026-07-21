import test from "node:test";
import assert from "node:assert/strict";
import {
  formatNewsArticleTeaser,
  localNewsPackageToArticleTeasers,
  resolveNationalNewsArticleTeasers,
} from "./homepageNewsTeasers.ts";

test("formatNewsArticleTeaser keeps up to four sentences", () => {
  const text =
    "First sentence. Second sentence! Third? Fourth. Fifth should drop.";
  assert.equal(
    formatNewsArticleTeaser(text),
    "First sentence. Second sentence! Third? Fourth."
  );
});

test("localNewsPackageToArticleTeasers prefers city and source attribution", () => {
  const articles = localNewsPackageToArticleTeasers(
    {
      lead: null,
      featureTopStory: {
        id: "local-1",
        headline: "Council vote tonight",
        summary: "Leaders will decide on the budget. The meeting starts at 6 p.m.",
        source: "Gilbert Sun",
      },
      sideStories: [],
      hasStories: true,
      deskBadge: "📰 Local News",
    },
    "Gilbert"
  );

  assert.equal(articles.length, 1);
  assert.equal(articles[0]?.attribution, "Gilbert Sun");
  assert.match(articles[0]?.teaser ?? "", /budget/);
});

test("resolveNationalNewsArticleTeasers prefers national_news package", () => {
  const articles = resolveNationalNewsArticleTeasers({
    nationalStories: [
      {
        id: "nat-1",
        rank: 1,
        headline: "Fed holds rates steady",
        summary: "Officials cited inflation progress. Markets reacted calmly.",
        sourceName: "AP",
        sourceUrl: "https://example.com/fed",
        publishedAt: null,
        category: "business",
        image: null,
        verification: {
          editorialScore: 90,
          reasons: [],
          pool: "test",
        },
      },
    ],
    leadStory: null,
    nationalTopStories: [],
  });

  assert.equal(articles.length, 1);
  assert.equal(articles[0]?.attribution, "AP");
});

test("resolveNationalNewsArticleTeasers falls back to legacy national top stories", () => {
  const articles = resolveNationalNewsArticleTeasers({
    nationalStories: [],
    leadStory: null,
    nationalTopStories: [
      {
        id: "legacy-1",
        headline: "Senate passes bill",
        summary: "The vote was close. The president may sign it this week.",
        source: "Reuters",
        url: null,
        role: "national",
      },
    ],
  });

  assert.equal(articles.length, 1);
  assert.equal(articles[0]?.headline, "Senate passes bill");
});
