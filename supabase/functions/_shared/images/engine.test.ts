import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveVerifiedEditorialCategory } from "../editorialCategory.ts";
import {
  buildEditorialImageSearchPlan,
  flattenSearchPlan,
} from "./searchPlan.ts";
import {
  isObviousScenicMismatch,
  scoreStockCandidateRelevance,
} from "./relevance.ts";
import { stockCandidateConflictsWithVenue } from "./quality.ts";
import type { StockSearchCandidate } from "./types.ts";

function candidate(overrides: Partial<StockSearchCandidate> & { providerImageId: string }): StockSearchCandidate {
  return {
    provider: "unsplash",
    downloadUrl: "https://example.com/photo.jpg",
    previewUrl: "https://example.com/preview.jpg",
    width: 1600,
    height: 2400,
    photographerName: "Editor",
    sourcePageUrl: "https://unsplash.com/photo",
    tags: [],
    orientation: "portrait",
    ...overrides,
  };
}

Deno.test("search plan prioritizes exact venue before category and broader", () => {
  const category = resolveVerifiedEditorialCategory({
    title: "Sushiya Japanese Restaurant",
    venueCategories: ["Japanese Restaurant", "Sushi Restaurant"],
    discoveryCategory: "restaurants",
    dek: "Fresh sushi and ramen in Gilbert.",
  });
  const plan = buildEditorialImageSearchPlan({
    title: "Sushiya Japanese Restaurant",
    city: "Gilbert",
    state: "Arizona",
    category,
  });

  assertEquals(plan[0]?.tier, "venue");
  assertEquals(
    plan[0]?.queries.some((q) => q.includes("Sushiya") && q.includes("Gilbert")),
    true
  );
  assertEquals(plan[1]?.tier, "category");
  assertEquals(
    plan[1]?.queries.some((q) => /restaurant|sushi|japanese|dining/i.test(q)),
    true
  );
  assertEquals(plan[2]?.tier, "broader");
  assertEquals(
    plan[2]?.queries.some((q) => /sushi|japanese food/i.test(q)),
    true
  );

  const flat = flattenSearchPlan(plan);
  assertEquals(flat.indexOf(flat.find((q) => q.includes("Sushiya"))!) <
    flat.findIndex((q) => /japanese food/i.test(q)), true);
});

Deno.test("rejects sushi restaurant matched to mountain scenery", () => {
  const mountain = candidate({
    providerImageId: "mountain-1",
    tags: ["mountain", "landscape", "scenic", "alps"],
    altDescription: "Mountain landscape at sunrise",
  });

  assertEquals(stockCandidateConflictsWithVenue(mountain, "restaurant"), false);
  assertEquals(isObviousScenicMismatch(mountain, "restaurant"), true);

  const scored = scoreStockCandidateRelevance(mountain, {
    venueTitle: "Sushiya Japanese Restaurant",
    categoryLabel: "Japanese restaurant",
    categoryTag: "restaurant",
    searchQuery: "Japanese restaurant interior",
    searchTier: "category",
    preferredOrientation: "portrait",
    compositionTag: "interior",
    categoryPhrases: ["Japanese restaurant dining room"],
  });
  assertEquals(scored === null, false);
  assertEquals((scored?.relevanceScore ?? 100) < 62, true);
});

Deno.test("rejects dog park playground imagery", () => {
  const playground = candidate({
    providerImageId: "playground-1",
    tags: ["playground", "swings", "slides", "children"],
    altDescription: "Children on playground swings",
  });

  assertEquals(stockCandidateConflictsWithVenue(playground, "dog_park"), true);
});

Deno.test("rejects museum beach imagery", () => {
  const beach = candidate({
    providerImageId: "beach-1",
    tags: ["beach", "ocean", "sand", "waves"],
    altDescription: "Sandy beach with ocean waves",
  });

  assertEquals(stockCandidateConflictsWithVenue(beach, "museum"), true);
});

Deno.test("rejects escape room ocean imagery", () => {
  const ocean = candidate({
    providerImageId: "ocean-1",
    tags: ["ocean", "waves", "surf", "beach"],
    altDescription: "Ocean waves crashing on shore",
  });

  assertEquals(stockCandidateConflictsWithVenue(ocean, "escape_room"), true);
});

Deno.test("prefers category-aligned sushi photo over unrelated scenic", () => {
  const sushi = candidate({
    providerImageId: "sushi-1",
    tags: ["sushi", "japanese", "restaurant", "dining", "food"],
    altDescription: "Sushi platter at Japanese restaurant",
  });
  const mountain = candidate({
    providerImageId: "mountain-2",
    tags: ["mountain", "landscape", "scenic"],
    altDescription: "Mountain vista",
  });

  const ctx = {
    venueTitle: "Sushiya Japanese Restaurant",
    categoryLabel: "Japanese restaurant",
    categoryTag: "restaurant" as const,
    searchQuery: "Japanese restaurant",
    searchTier: "category" as const,
    preferredOrientation: "portrait" as const,
    compositionTag: "interior",
    categoryPhrases: ["local restaurant dining room", "Japanese restaurant"],
  };

  const sushiScore = scoreStockCandidateRelevance(sushi, ctx)!;
  const mountainScore = scoreStockCandidateRelevance(mountain, ctx);

  assertEquals(Boolean(mountainScore), true);
  assertEquals(sushiScore.relevanceScore > (mountainScore?.relevanceScore ?? 0), true);
  assertEquals(/category|name|quality/i.test(sushiScore.winReason), true);
});

Deno.test("verification report shape includes provider query score and reason", () => {
  const category = resolveVerifiedEditorialCategory({
    title: "Cosmo Dog Park",
    venueCategories: ["Dog Park"],
    discoveryCategory: "parks",
  });
  const plan = buildEditorialImageSearchPlan({
    title: "Cosmo Dog Park",
    city: "Gilbert",
    category,
  });
  const winner = scoreStockCandidateRelevance(
    candidate({
      providerImageId: "dog-1",
      provider: "pixabay",
      tags: ["dog park", "dogs playing", "fenced"],
      altDescription: "Dogs playing in fenced dog park",
    }),
    {
      venueTitle: "Cosmo Dog Park",
      categoryLabel: "dog park",
      categoryTag: "dog_park",
      searchQuery: "dog park dogs playing",
      searchTier: "category",
      preferredOrientation: "portrait",
      compositionTag: "open_field",
      categoryPhrases: ["dog park dogs playing", "fenced dog park"],
    }
  )!;

  const report = {
    provider: winner.provider,
    searchTermsAttempted: flattenSearchPlan(plan),
    selectedQuery: winner.searchQuery,
    searchTier: winner.searchTier,
    relevanceScore: winner.relevanceScore,
    winReason: winner.winReason,
    breakdown: winner.breakdown,
  };

  assertEquals(report.provider, "pixabay");
  assertEquals(report.searchTermsAttempted.length >= 3, true);
  assertEquals(report.relevanceScore >= 62, true);
  assertEquals(report.winReason.length > 0, true);
});
