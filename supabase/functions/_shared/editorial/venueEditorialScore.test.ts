import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeVenueEditorialScore,
  resolveVenueEditorialWithOverrides,
  VENUE_EDITORIAL_TIER_SIGNATURE,
  VENUE_EDITORIAL_UNVERIFIED_CAP,
} from "../editorial/venueEditorialScore.ts";

function venueInput(
  overrides: Partial<Parameters<typeof computeVenueEditorialScore>[0]> = {}
) {
  return {
    kindredVenueId: "venue-1",
    name: "Joe's Neighborhood Coffee",
    providerCategories: ["Coffee Shop", "Bakery"],
    editorialCategories: ["coffee"],
    editorialTeaser:
      "Independent coffee shop with neighborhood regulars and patio seating.",
    cuisine: "coffee",
    lifecycle: "verified" as const,
    verificationStatus: "verified",
    confidenceScore: 82,
    isChain: false,
    ...overrides,
  };
}

Deno.test("independent local venue outranks comparable chain", () => {
  const local = computeVenueEditorialScore(venueInput());
  const chain = computeVenueEditorialScore(
    venueInput({
      name: "Starbucks",
      isChain: true,
      providerCategories: ["Coffee Shop"],
    })
  );
  assertEquals(local.score > chain.score, true);
});

Deno.test("high provider rating does not change editorial score", () => {
  const withRating = computeVenueEditorialScore(
    venueInput({ providerRating: 4.9, providerReviewCount: 5000 })
  );
  const withoutRating = computeVenueEditorialScore(
    venueInput({ providerRating: null, providerReviewCount: null })
  );
  assertEquals(withRating.score, withoutRating.score);
});

Deno.test("unverified venue cannot become an Editor's Pick", () => {
  const unverified = computeVenueEditorialScore(
    venueInput({
      lifecycle: "new",
      verificationStatus: "pending",
      confidenceScore: 40,
    })
  );
  assertEquals(unverified.score <= VENUE_EDITORIAL_UNVERIFIED_CAP, true);
  assertEquals(unverified.labels.includes("editors_pick"), false);
});

Deno.test("manual editorial lock preserves override values", () => {
  const computed = computeVenueEditorialScore(venueInput());
  const locked = resolveVenueEditorialWithOverrides(computed, {
    editorial_lock: true,
    editorial_score_override: 95,
    editorial_labels_override: ["editors_pick"],
    editorial_reason_override: "Manual Kindred desk promotion.",
  });
  assertEquals(locked.score, 95);
  assertEquals(locked.labels.includes("editors_pick"), true);
});

Deno.test("labels assigned only when supported by evidence", () => {
  const coffee = computeVenueEditorialScore(
    venueInput({
      providerCategories: ["Coffee Shop"],
      cuisine: "coffee",
    })
  );
  assertEquals(coffee.labels.includes("best_coffee"), true);

  const generic = computeVenueEditorialScore(
    venueInput({
      name: "Place 123",
      providerCategories: ["Restaurant"],
      cuisine: null,
      editorialTeaser: null,
    })
  );
  assertEquals(generic.labels.includes("best_brunch"), false);
});

Deno.test("signature tier may include editors_pick when verified", () => {
  const scored = computeVenueEditorialScore(
    venueInput({
      lifecycle: "featured",
      editorialTeaser:
        "Independent bakery on a historic block with patio seating and a neighborhood following.",
    })
  );
  if (scored.score >= VENUE_EDITORIAL_TIER_SIGNATURE) {
    assertEquals(scored.labels.includes("editors_pick"), true);
  }
});
