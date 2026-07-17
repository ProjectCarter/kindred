import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cityArticleSourceNote,
  parseStoryOfSourceNote,
} from "./sourceNote.ts";

Deno.test("cityArticleSourceNote round-trips story metadata", () => {
  const note = cityArticleSourceNote({
    metroKey: "seattle-wa",
    cityName: "Seattle",
    headline: "The Story of Seattle",
    subtitle: "How a harbor city took shape.",
    body: "Body",
    furtherReading: [
      "https://www.seattle.gov/cityarchives",
      "https://www.historylink.org/",
    ],
    image: {
      url: "https://example.com/pike.jpg",
      caption: "Pike Place Market",
      credit: "Photo: Example / Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
      license: "CC BY-SA 3.0",
    },
  });

  const parsed = parseStoryOfSourceNote(note);
  assertEquals(parsed?.kind, "story_of");
  assertEquals(parsed?.metroKey, "seattle-wa");
  assertEquals(parsed?.subtitle, "How a harbor city took shape.");
  assertEquals(parsed?.furtherReading.length, 2);
  assertEquals(parsed?.cityImage.url, "https://example.com/pike.jpg");
});

Deno.test("parseStoryOfSourceNote accepts legacy your_city kind", () => {
  const legacy = JSON.stringify({
    kind: "your_city",
    metroKey: "gilbert-az",
    subtitle: "Farm town roots.",
    furtherReading: [],
    cityImage: {
      url: "https://example.com/tower.jpg",
      caption: "Tower",
      credit: "Credit",
      sourcePageUrl: "https://example.com",
      license: "CC0",
      assetKind: "photograph",
      source: "wikimedia_commons",
      resolvedAt: "2020-01-01T00:00:00.000Z",
    },
  });
  const parsed = parseStoryOfSourceNote(legacy);
  assertEquals(parsed?.kind, "story_of");
  assertEquals(parsed?.metroKey, "gilbert-az");
});
