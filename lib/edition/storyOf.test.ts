import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  editionSectionFromCityArticle,
  isStoryOfSection,
  parseStoryOfSourceNote,
  storyOfTitle,
  syntheticStoryOfSectionId,
} from "./storyOf.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gilbert = JSON.parse(
  readFileSync(
    path.join(__dirname, "../../content/city-articles/gilbert-az.json"),
    "utf8"
  )
);

test("storyOfTitle uses canonical headline format", () => {
  assert.equal(storyOfTitle("Gilbert"), "The Story of Gilbert");
});

test("editionSectionFromCityArticle builds a valid story_of section", () => {
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
  assert.equal(section!.section_type, "story_of");
  assert.equal(section!.headline, "The Story of Gilbert");
  assert.ok(isStoryOfSection(section!.section_type));

  const note = parseStoryOfSourceNote(section!.source_note);
  assert.equal(note?.kind, "story_of");
  assert.equal(note?.subtitle, gilbert.subtitle);
  assert.ok(note?.cityImage?.url?.includes("Gilbert_Water_Tower"));
});

test("isStoryOfSection recognizes story_of and legacy your_city", () => {
  assert.equal(isStoryOfSection("story_of"), true);
  assert.equal(isStoryOfSection("your_city"), true);
  assert.equal(isStoryOfSection("local_events"), false);
});

test("syntheticStoryOfSectionId is stable per metro", () => {
  const a = syntheticStoryOfSectionId("gilbert-az");
  const b = syntheticStoryOfSectionId("gilbert-az");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f-]{36}$/i);
});
