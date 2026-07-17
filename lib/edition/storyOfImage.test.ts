import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isDirectLoadableImageUrl,
  normalizeStoryOfImageUrl,
  nextStoryOfImageFallback,
  resolveStoryOfCityImage,
  STORY_OF_CARD_ASPECT_RATIO,
} from "./storyOfImage.ts";
import { buildStoryOfSourceNote } from "./storyOf.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gilbert = JSON.parse(
  readFileSync(
    path.join(__dirname, "../../content/city-articles/gilbert-az.json"),
    "utf8"
  )
);

const GILBERT_PRIMARY =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Gilbert-Gilbert_Water_Tower-1925.jpg/960px-Gilbert-Gilbert_Water_Tower-1925.jpg";

const BROKEN_GILBERT =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Gilbert_Water_Tower%2C_Gilbert%2C_Arizona.jpg/960px-Gilbert_Water_Tower%2C_Gilbert%2C_Arizona.jpg";

test("Gilbert seed uses a direct loadable Wikimedia image URL", () => {
  assert.equal(isDirectLoadableImageUrl(gilbert.image.url), true);
  assert.notEqual(gilbert.image.url, BROKEN_GILBERT);
  assert.match(gilbert.image.url, /Gilbert-Gilbert_Water_Tower-1925/);
});

test("normalizeStoryOfImageUrl corrects the legacy broken Gilbert URL", () => {
  assert.equal(normalizeStoryOfImageUrl(BROKEN_GILBERT), GILBERT_PRIMARY);
});

test("resolveStoryOfCityImage returns Gilbert primary from source_note", () => {
  const sourceNote = buildStoryOfSourceNote({
    metroKey: gilbert.metroKey,
    subtitle: gilbert.subtitle,
    furtherReading: gilbert.furtherReading,
    image: gilbert.image,
  });

  const resolved = resolveStoryOfCityImage({
    sourceNote,
    metroKey: gilbert.metroKey,
  });

  assert.ok(resolved);
  assert.equal(resolved!.resolvedUrl, GILBERT_PRIMARY);
  assert.equal(resolved!.fallbackLevel, "primary");
  assert.match(resolved!.credit, /Tony the Marine/);
});

test("broken persisted URL is corrected before render", () => {
  const sourceNote = buildStoryOfSourceNote({
    metroKey: "gilbert-az",
    subtitle: "Subtitle for Gilbert.",
    furtherReading: ["https://www.gilbertaz.gov/"],
    image: {
      url: BROKEN_GILBERT,
      caption: "Old caption",
      credit: "Photo: Tony the Marine / Wikimedia Commons (CC BY-SA 3.0)",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Old.jpg",
      license: "CC BY-SA 3.0",
    },
  });

  const resolved = resolveStoryOfCityImage({ sourceNote, metroKey: "gilbert-az" });
  assert.equal(resolved?.resolvedUrl, GILBERT_PRIMARY);
});

test("nextStoryOfImageFallback advances to approved alternate for Gilbert", () => {
  const sourceNote = buildStoryOfSourceNote({
    metroKey: gilbert.metroKey,
    subtitle: gilbert.subtitle,
    furtherReading: gilbert.furtherReading,
    image: gilbert.image,
  });

  const alternate = nextStoryOfImageFallback({
    sourceNote,
    metroKey: gilbert.metroKey,
    failedUrl: GILBERT_PRIMARY,
  });

  assert.ok(alternate);
  assert.equal(alternate!.fallbackLevel, "alternate");
  assert.notEqual(alternate!.resolvedUrl, GILBERT_PRIMARY);
  assert.match(alternate!.resolvedUrl, /Gilbert_Watertower_-_North/);
});

test("homepage card aspect ratio is editorial landscape not portrait", () => {
  assert.ok(STORY_OF_CARD_ASPECT_RATIO > 1);
  assert.equal(STORY_OF_CARD_ASPECT_RATIO, 3 / 2);
});

test("wiki description pages are rejected as image URLs", () => {
  assert.equal(
    isDirectLoadableImageUrl(
      "https://commons.wikimedia.org/wiki/File:Gilbert-Gilbert_Water_Tower-1925.jpg"
    ),
    false
  );
});

test("missing or wiki-page URL resolves to null for compact placeholder", () => {
  const sourceNote = buildStoryOfSourceNote({
    metroKey: "unknown-metro",
    subtitle: "Subtitle.",
    furtherReading: [],
    image: {
      url: "https://commons.wikimedia.org/wiki/File:Some_Page.jpg",
      caption: "Bad",
      credit: "Photo: Test",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Some_Page.jpg",
      license: "CC BY-SA 3.0",
    },
  });

  const resolved = resolveStoryOfCityImage({ sourceNote, metroKey: "unknown-metro" });
  assert.equal(resolved, null);
});

test("same resolved image is used for homepage and article handoff", () => {
  const sourceNote = buildStoryOfSourceNote({
    metroKey: gilbert.metroKey,
    subtitle: gilbert.subtitle,
    furtherReading: gilbert.furtherReading,
    image: gilbert.image,
  });

  const homepage = resolveStoryOfCityImage({ sourceNote, metroKey: gilbert.metroKey });
  const article = resolveStoryOfCityImage({ sourceNote, metroKey: gilbert.metroKey });

  assert.equal(homepage?.resolvedUrl, article?.resolvedUrl);
  assert.equal(homepage?.resolvedUrl, GILBERT_PRIMARY);
});
