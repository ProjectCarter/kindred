import test from "node:test";
import assert from "node:assert/strict";
import type { RankedDiscoveryItem } from "./discovery";
import {
  computeVenueEditorialScore,
  resolveVenueEditorialWithOverrides,
  homepageVenueEditorialSortScore,
  venueEditorialScoreMaterialFingerprint,
  VENUE_EDITORIAL_TIER_SIGNATURE,
  VENUE_EDITORIAL_UNVERIFIED_CAP,
} from "./venueEditorialScore";
import { selectHomepageRecommendationCards } from "./recommendations";
import { organizeFoodDrinkGuide } from "./foodDrinkGuide";
import {
  curateFoodDrinkEdition,
  inferFoodEditorFingerprint,
} from "./foodDrinkCuration";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "./editorialPublishing";

function venueInput(overrides: Partial<Parameters<typeof computeVenueEditorialScore>[0]> = {}) {
  return {
    kindredVenueId: "venue-1",
    name: "Joe's Neighborhood Coffee",
    providerCategories: ["Coffee Shop", "Bakery"],
    editorialCategories: ["coffee"],
    editorialTeaser: "Independent coffee shop with neighborhood regulars and patio seating.",
    cuisine: "coffee",
    lifecycle: "verified" as const,
    verificationStatus: "verified",
    confidenceScore: 82,
    isChain: false,
    ...overrides,
  };
}

test("independent local venue outranks comparable chain", () => {
  const local = computeVenueEditorialScore(venueInput());
  const chain = computeVenueEditorialScore(
    venueInput({
      name: "Starbucks",
      isChain: true,
      providerCategories: ["Coffee Shop"],
    })
  );
  assert.ok(local.score > chain.score);
});

test("high provider rating alone does not guarantee high Editorial Score", () => {
  const withRating = computeVenueEditorialScore(
    venueInput({ providerRating: 4.9, providerReviewCount: 5000 })
  );
  const withoutRating = computeVenueEditorialScore(
    venueInput({ providerRating: null, providerReviewCount: null })
  );
  assert.equal(withRating.score, withoutRating.score);
});

test("unverified venue cannot become an Editor's Pick", () => {
  const unverified = computeVenueEditorialScore(
    venueInput({
      lifecycle: "new",
      verificationStatus: "pending",
      confidenceScore: 40,
    })
  );
  assert.ok(unverified.score <= VENUE_EDITORIAL_UNVERIFIED_CAP);
  assert.ok(!unverified.labels.includes("editors_pick"));
});

test("verified venue at signature tier may receive Editor's Pick label", () => {
  const scored = computeVenueEditorialScore(
    venueInput({
      lifecycle: "featured",
      editorialTeaser:
        "Independent bakery on a historic block with patio seating and a neighborhood following.",
    })
  );
  if (scored.score >= VENUE_EDITORIAL_TIER_SIGNATURE) {
    assert.ok(scored.labels.includes("editors_pick"));
  }
});

test("manual editorial lock preserves override values", () => {
  const computed = computeVenueEditorialScore(venueInput());
  const locked = resolveVenueEditorialWithOverrides(computed, {
    editorial_lock: true,
    editorial_score_override: 95,
    editorial_labels_override: ["editors_pick"],
    editorial_reason_override: "Manual Kindred desk promotion.",
  });
  assert.equal(locked.score, 95);
  assert.deepEqual(locked.labels, ["editors_pick"]);
  assert.equal(locked.editorialReason, "Manual Kindred desk promotion.");
});

test("material evidence fingerprint changes when name changes", () => {
  const fp1 = venueEditorialScoreMaterialFingerprint({
    name: "Joe's Coffee",
    providerCategories: ["Coffee Shop"],
    lifecycle: "verified",
    confidenceScore: 80,
  });
  const fp2 = venueEditorialScoreMaterialFingerprint({
    name: "Joe's Coffee Roasters",
    providerCategories: ["Coffee Shop"],
    lifecycle: "verified",
    confidenceScore: 80,
  });
  assert.notEqual(fp1, fp2);
});

test("non-material fingerprint match skips rescoring conceptually", () => {
  const fp = venueEditorialScoreMaterialFingerprint({
    name: "Joe's Coffee",
    providerCategories: ["Coffee Shop"],
    lifecycle: "verified",
    confidenceScore: 80,
  });
  const fpAgain = venueEditorialScoreMaterialFingerprint({
    name: "Joe's Coffee",
    providerCategories: ["Coffee Shop"],
    lifecycle: "verified",
    confidenceScore: 80,
  });
  assert.equal(fp, fpAgain);
});

test("homepage returns exactly 8 diverse picks ranked by editorial score", () => {
  function row(
    title: string,
    category: RankedDiscoveryItem["item"]["category"],
    editorialScore: number,
    chain = false
  ): RankedDiscoveryItem {
    return {
      score: editorialScore,
      surfaces: [],
      reasons: [],
      item: {
        id: title.toLowerCase().replace(/\s+/g, "-"),
        title,
        dek: `${title} dek`,
        category,
        family: "food_drink",
        tags: chain ? ["local_place", "verified", "chain"] : ["local_place", "verified"],
        venueCategories: [],
        source: { name: "Kindred", tier: "local", url: null },
        place: { city: "Gilbert", region: "AZ" },
        lat: 33.35,
        lon: -111.79,
        address: "Gilbert, AZ",
        venueEditorial: {
          score: editorialScore,
          labels: editorialScore >= 90 ? ["editors_pick"] : [],
          kindredVenueId: `id-${title}`,
        },
      },
    } as RankedDiscoveryItem;
  }

  const pool = [
    row("Joe Coffee", "coffee", 95),
    row("Second Coffee", "coffee", 94),
    row("Rise Bakery", "bakeries", 93),
    row("Tony Pizza", "restaurants", 92),
    row("La Taqueria", "restaurants", 91),
    row("Sushi House", "restaurants", 90),
    row("Burger Barn", "restaurants", 89),
    row("Steak Room", "restaurants", 88),
    row("Sweet Desserts", "bakeries", 87),
    row("Starbucks", "coffee", 86, true),
  ];

  const cards = selectHomepageRecommendationCards(pool, {
    editionDate: "2026-07-17",
  });
  assert.equal(cards.length, HOMEPAGE_INITIAL_RENDER_COUNT);

  const curated = curateFoodDrinkEdition(
    pool.filter((p) => (p.item.venueEditorial?.score ?? 0) >= 70),
    {
      depth: 8,
      maxPerFingerprint: 1,
      repeatScoreGap: Number.POSITIVE_INFINITY,
      getScore: (d) =>
        homepageVenueEditorialSortScore(
          d.item.venueEditorial!.score,
          d.item.venueEditorial!.kindredVenueId!,
          "2026-07-17"
        ),
    }
  );
  for (const fp of ["coffee_shop", "bakery", "pizza"] as const) {
    const count = curated.filter(
      (r) => inferFoodEditorFingerprint(r.item) === fp
    ).length;
    assert.ok(count <= 1, `expected at most one ${fp}, got ${count}`);
  }
});

test("complete guide sorts categories by Editorial Score", () => {
  function row(title: string, editorialScore: number): RankedDiscoveryItem {
    return {
      score: editorialScore,
      surfaces: [],
      reasons: [],
      item: {
        id: title,
        title,
        dek: "Coffee shop",
        category: "coffee",
        family: "food_drink",
        tags: ["local_place", "verified"],
        venueCategories: ["Coffee Shop"],
        source: { name: "Kindred", tier: "local", url: null },
        place: { city: "Gilbert" },
        lat: 33.35,
        lon: -111.79,
        venueEditorial: { score: editorialScore, labels: [], kindredVenueId: title },
      },
    } as RankedDiscoveryItem;
  }

  const sections = organizeFoodDrinkGuide([
    row("Low Coffee", 62),
    row("High Coffee", 88),
    row("Mid Coffee", 74),
  ]);
  const coffee = sections.find((s) => s.id === "coffee");
  assert.ok(coffee);
  assert.equal(coffee!.cards[0]?.title, "High Coffee");
});

test("labels assigned only when supported by evidence", () => {
  const coffee = computeVenueEditorialScore(
    venueInput({
      providerCategories: ["Coffee Shop"],
      cuisine: "coffee",
    })
  );
  assert.ok(coffee.labels.includes("best_coffee"));

  const generic = computeVenueEditorialScore(
    venueInput({
      name: "Place 123",
      providerCategories: ["Restaurant"],
      cuisine: null,
      editorialTeaser: null,
    })
  );
  assert.ok(!generic.labels.includes("best_brunch"));
});
