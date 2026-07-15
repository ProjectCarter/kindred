import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { StockSearchCandidate } from "../images/types.ts";
import {
  buildHistoricalImageSearchQueries,
  classifyHistoricalAssetKind,
  formatHistoricalCredit,
  scoreHistoricalCandidate,
} from "./historicalImages.ts";

function candidate(
  overrides: Partial<StockSearchCandidate> & { providerImageId: string }
): StockSearchCandidate {
  return {
    provider: "wikimedia",
    downloadUrl: "https://upload.wikimedia.org/example.jpg",
    previewUrl: "https://upload.wikimedia.org/example-thumb.jpg",
    width: 1200,
    height: 900,
    photographerName: "Library of Congress",
    sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    tags: [],
    orientation: "landscape",
    altDescription: "Example historical image",
    licenseShortName: "Public domain",
    licenseUrl: null,
    attributionText: "Image from Wikimedia Commons — Library of Congress — Public domain",
    ...overrides,
  };
}

Deno.test("buildHistoricalImageSearchQueries includes year and asset types", () => {
  const queries = buildHistoricalImageSearchQueries({
    onThisDay: { year: 1969, text: "Apollo 11 lands on the Moon" },
    subject: "Apollo 11",
  });

  assertEquals(queries.some((q) => q.includes("1969")), true);
  assertEquals(queries.some((q) => /engraving|photograph|map|newspaper/i.test(q)), true);
});

Deno.test("classifyHistoricalAssetKind detects maps and engravings", () => {
  assertEquals(
    classifyHistoricalAssetKind("Vintage map of Boston harbor, 1775"),
    "map"
  );
  assertEquals(
    classifyHistoricalAssetKind("Steel engraving of the signing ceremony"),
    "engraving"
  );
});

Deno.test("scoreHistoricalCandidate prefers subject and year matches", () => {
  const strong = candidate({
    providerImageId: "1",
    altDescription: "Apollo 11 lunar module photograph, July 1969, NASA archive",
    tags: ["apollo", "moon", "photograph", "1969"],
  });
  const weak = candidate({
    providerImageId: "2",
    altDescription: "Modern app logo screenshot",
    tags: ["logo", "screenshot"],
  });

  const strongScore = scoreHistoricalCandidate(strong, "Apollo 11", 1969);
  const weakScore = scoreHistoricalCandidate(weak, "Apollo 11", 1969);

  assertEquals(strongScore > weakScore, true);
  assertEquals(weakScore < 8, true);
});

Deno.test("formatHistoricalCredit prefers explicit attribution text", () => {
  assertEquals(
    formatHistoricalCredit({
      source: "wikimedia_commons",
      attributionText: "Library of Congress — Public domain",
      sourcePageUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
      assetKind: "photograph",
    }),
    "Library of Congress — Public domain"
  );
});
