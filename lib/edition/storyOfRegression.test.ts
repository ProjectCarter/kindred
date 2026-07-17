import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeFrozenSections } from "./editionFreeze.ts";
import {
  homepageDeskPresence,
  homepageDesksInRenderOrder,
  metroExpectsStoryOf,
} from "./storyOfCoverage.ts";
import {
  editionSectionFromCityArticle,
  isStoryOfSection,
  parseStoryOfSourceNote,
} from "./storyOf.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const gilbert = JSON.parse(
  readFileSync(
    path.join(__dirname, "../../content/city-articles/gilbert-az.json"),
    "utf8"
  )
);

test("metroExpectsStoryOf is true for seeded Gilbert metro", () => {
  assert.equal(metroExpectsStoryOf("gilbert-az"), true);
  assert.equal(metroExpectsStoryOf("phoenix-az"), false);
});

test("homepage editorial order places story_of before today_in_history", () => {
  const presence = homepageDeskPresence({
    hasActivities: true,
    hasRecommendations: true,
    hasStoryOf: true,
    hasTodayInHistory: true,
    hasBanditsPick: true,
  });
  const order = homepageDesksInRenderOrder(presence);
  const storyIdx = order.indexOf("story_of");
  const historyIdx = order.indexOf("today_in_history");
  assert.ok(storyIdx >= 0);
  assert.ok(historyIdx >= 0);
  assert.ok(storyIdx < historyIdx);
});

test("mergeFrozenSections adds missing story_of from network payload", () => {
  const cached = [
    {
      id: "a",
      section_type: "local_events",
      position: 3,
      headline: "Events",
      body: '{"events":[]}',
    },
    {
      id: "b",
      section_type: "today_in_history",
      position: 4,
      headline: "1776 — A day",
      body: "History body",
    },
  ];
  const network = [
    ...cached,
    {
      id: "c",
      section_type: "story_of",
      position: 5,
      headline: "The Story of Gilbert",
      body: "City story body",
      source_note: JSON.stringify({ kind: "story_of", metroKey: "gilbert-az" }),
    },
  ];

  const merged = mergeFrozenSections(cached, network);
  assert.equal(
    merged.filter((s) => isStoryOfSection(s.section_type)).length,
    1
  );
  assert.equal(merged.find((s) => s.section_type === "story_of")?.position, 5);
});

test("story_of section is eligible for article reader", () => {
  assert.equal(isStoryOfSection("story_of"), true);
  assert.equal(isStoryOfSection("local_events"), false);
});

test("story_of source note parses for reader handoff", () => {
  const section = editionSectionFromCityArticle(
    {
      metro_key: gilbert.metroKey,
      city_name: gilbert.cityName,
      headline: gilbert.headline,
      subtitle: gilbert.subtitle,
      body: gilbert.body,
      image_url: gilbert.image.url,
      image_caption: gilbert.image.caption,
      image_credit: gilbert.image.credit,
      image_source_url: gilbert.image.sourceUrl,
      image_license: gilbert.image.license,
      sources: gilbert.furtherReading,
    },
    gilbert.metroKey
  );
  assert.ok(section);
  const note = parseStoryOfSourceNote(section!.source_note);
  assert.ok(note?.subtitle);
  assert.ok(note?.cityImage?.url);
});

test("duplicate story_of sections are detectable", () => {
  const section = editionSectionFromCityArticle(
    {
      metro_key: gilbert.metroKey,
      city_name: gilbert.cityName,
      headline: gilbert.headline,
      subtitle: gilbert.subtitle,
      body: gilbert.body,
      image_url: gilbert.image.url,
      image_caption: gilbert.image.caption,
      image_credit: gilbert.image.credit,
      image_source_url: gilbert.image.sourceUrl,
      image_license: gilbert.image.license,
      sources: gilbert.furtherReading,
    },
    gilbert.metroKey
  );
  const types = [
    section!.section_type,
    section!.section_type,
    "today_in_history",
  ];
  const storyCount = types.filter((t) => isStoryOfSection(t)).length;
  assert.equal(storyCount, 2);
});
