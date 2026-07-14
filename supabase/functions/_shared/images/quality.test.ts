import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeBaselineQualityScore,
  effectiveSelectionScore,
  isLibraryRowSelectable,
} from "./quality.ts";
import {
  compositionSearchQuery,
  pickCompositionSlot,
  rankStockCandidates,
} from "./variety.ts";

Deno.test("quality score stays within 1-100", () => {
  const { score } = computeBaselineQualityScore({
    width: 1200,
    height: 1800,
    orientation: "portrait",
    preferredOrientation: "portrait",
    compositionTag: "latte_art",
    tags: ["coffee", "latte", "cafe", "morning", "foam"],
  });
  assertEquals(score >= 1 && score <= 100, true);
});

Deno.test("effective selection penalizes heavy skips", () => {
  const fresh = effectiveSelectionScore(80, 0, 0);
  const skipped = effectiveSelectionScore(80, 10, 0);
  assertEquals(fresh > skipped, true);
});

Deno.test("weak heavily-skipped images become unselectable", () => {
  assertEquals(isLibraryRowSelectable(40, 25), false);
  assertEquals(isLibraryRowSelectable(70, 5), true);
});

Deno.test("composition slots rotate within category", () => {
  const first = pickCompositionSlot("coffee_shop", 0);
  const second = pickCompositionSlot("coffee_shop", 1);
  assertEquals(first !== second, true);
});

Deno.test("composition search query adds editorial phrase", () => {
  const query = compositionSearchQuery("coffee shop", "latte_art");
  assertEquals(query.includes("latte"), true);
});

Deno.test("stock candidates rank by quality minus variety collision", () => {
  const candidates = [
    {
      provider: "pexels" as const,
      providerImageId: "1",
      downloadUrl: "https://example.com/1.jpg",
      previewUrl: "https://example.com/1-sm.jpg",
      width: 1200,
      height: 1800,
      photographerName: "Alex",
      sourcePageUrl: "https://pexels.com/1",
      tags: ["latte", "art"],
      orientation: "portrait" as const,
    },
    {
      provider: "pexels" as const,
      providerImageId: "2",
      downloadUrl: "https://example.com/2.jpg",
      previewUrl: "https://example.com/2-sm.jpg",
      width: 2000,
      height: 3000,
      photographerName: "Blake",
      sourcePageUrl: "https://pexels.com/2",
      tags: ["storefront", "cafe"],
      orientation: "portrait" as const,
    },
  ];

  const ranked = rankStockCandidates(
    candidates,
    (c) => (c.providerImageId === "2" ? 75 : 70),
    {
      compositions: new Set(["latte_art"]),
      subjects: new Set(),
      colors: new Set(),
      hashes: new Set(),
      photographers: new Set(),
    },
    "storefront",
    "coffee_shop"
  );

  assertEquals(ranked[0]?.providerImageId, "2");
});
