/**
 * Local News homepage package — Node smoke tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_NEWS_EMPTY_PLACEHOLDER,
  resolveLocalNewsHomePackage,
} from "./localNewsHome.ts";

test("resolveLocalNewsHomePackage uses local top story when lead is missing", () => {
  const pkg = resolveLocalNewsHomePackage({
    leadStory: null,
    topStories: [
      {
        id: "local-1",
        headline: "Council vote",
        summary: "A local briefing.",
        source: "East Valley Tribune",
        url: null,
        role: "local",
      },
    ],
  });
  assert.equal(pkg.hasStories, true);
  assert.equal(pkg.lead, null);
  assert.equal(pkg.featureTopStory?.id, "local-1");
  assert.equal(pkg.deskBadge, "📰 Local News");
});

test("resolveLocalNewsHomePackage prefers local lead over top stories", () => {
  const pkg = resolveLocalNewsHomePackage({
    leadStory: {
      id: "lead-1",
      headline: "Lead headline",
      summary: "Lead dek",
      source: "Local Source",
      url: null,
      publishedAt: null,
      role: "local",
      heroImage: { uri: null, alt: "Lead headline", source: "none" },
      banditsPick: { reserved: true, isBanditsPick: false },
      selection: {
        score: 1,
        reasons: [],
        belowFoldTitles: [],
        strategy: "prefer_local",
      },
    },
    topStories: [
      {
        id: "local-2",
        headline: "Side story",
        summary: "Side summary",
        source: "Paper",
        url: null,
        role: "local",
      },
    ],
  });
  assert.equal(pkg.lead?.id, "lead-1");
  assert.equal(pkg.featureTopStory, null);
  assert.equal(pkg.sideStories[0]?.id, "local-2");
  assert.equal(pkg.deskBadge, "📰 Local News");
});

test("sports fallback lead surfaces sports badge", () => {
  const pkg = resolveLocalNewsHomePackage({
    leadStory: {
      id: "sports-1",
      headline: "Suns win",
      summary: "Phoenix Suns take game one.",
      source: "Arizona Sports",
      url: null,
      publishedAt: null,
      role: "local",
      contentType: "sports",
      deskBadge: "🏈 Sports",
      heroImage: { uri: null, alt: "Suns win", source: "none" },
      banditsPick: { reserved: true, isBanditsPick: false },
      selection: {
        score: 1,
        reasons: [],
        belowFoldTitles: [],
        strategy: "prefer_local",
      },
    },
    topStories: [],
  });
  assert.equal(pkg.hasStories, true);
  assert.equal(pkg.deskBadge, "🏈 Sports");
});

test("empty local desk exposes placeholder copy", () => {
  const pkg = resolveLocalNewsHomePackage({ leadStory: null, topStories: [] });
  assert.equal(pkg.hasStories, false);
  assert.equal(LOCAL_NEWS_EMPTY_PLACEHOLDER, "No major local updates today.");
});

test("mislabeled local-desk slate still surfaces when lead is absent", () => {
  const pkg = resolveLocalNewsHomePackage({
    leadStory: null,
    topStories: [
      {
        id: "wire-1",
        headline: "City council vote",
        summary: "A local briefing from the wire.",
        source: "East Valley Tribune",
        url: null,
        role: "national",
      },
      {
        id: "wire-2",
        headline: "School bond",
        summary: "District voters weigh a bond.",
        source: "Local Paper",
        url: null,
        role: "interest",
      },
    ],
  });
  assert.equal(pkg.hasStories, true);
  assert.equal(pkg.featureTopStory?.id, "wire-1");
  assert.equal(pkg.sideStories[0]?.id, "wire-2");
});

test("non-local lead does not steal top stories into Local News", () => {
  const pkg = resolveLocalNewsHomePackage({
    leadStory: {
      id: "nat-lead",
      headline: "National lead",
      summary: "Wider world",
      source: "Wire",
      url: null,
      publishedAt: null,
      role: "national",
      heroImage: { uri: null, alt: "National lead", source: "none" },
      banditsPick: { reserved: true, isBanditsPick: false },
      selection: {
        score: 1,
        reasons: [],
        belowFoldTitles: [],
        strategy: "national_world",
      },
    },
    topStories: [
      {
        id: "nat-1",
        headline: "World story",
        summary: "A national wire.",
        source: "AP",
        url: null,
        role: "national",
      },
    ],
  });
  assert.equal(pkg.hasStories, false);
  assert.equal(pkg.featureTopStory, null);
});
