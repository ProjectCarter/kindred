import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildLastingImpressionPromptBlock,
  closingRepeatsEarlierParagraph,
  containsPromotionalClosing,
  ensureLastingImpressionClosing,
  LASTING_IMPRESSION_EXAMPLES,
  lastingImpressionClosingForPlace,
  selectLastingImpressionClosing,
  validateLastingImpressionClosing,
} from "./lastingImpression.ts";

Deno.test("containsPromotionalClosing rejects call-to-action endings", () => {
  assert(containsPromotionalClosing("Check it out this weekend."));
  assert(containsPromotionalClosing("A great place to spend the day with everyone."));
  assert(!containsPromotionalClosing(LASTING_IMPRESSION_EXAMPLES[0]!));
});

Deno.test("validateLastingImpressionClosing rejects summary and promotional closings", () => {
  assertEquals(
    validateLastingImpressionClosing("In summary, this museum is worth your time.").reason,
    "summary"
  );
  assertEquals(
    validateLastingImpressionClosing("Don't miss it — perfect for everyone.").reason,
    "promotional"
  );
});

Deno.test("validateLastingImpressionClosing accepts timeless editor observations", () => {
  const result = validateLastingImpressionClosing(
    "The best discoveries are often the ones that never needed a headline."
  );
  assert(result.passes);
});

Deno.test("closingRepeatsEarlierParagraph detects repeated conclusions", () => {
  const prior = [
    "The best discoveries are often the ones that never needed a headline.",
    "Morning light reaches the ridge first on weekday hikes.",
  ];
  assert(
    closingRepeatsEarlierParagraph(
      "The best discoveries are often the ones that never needed a headline.",
      prior
    )
  );
  assert(
    !closingRepeatsEarlierParagraph(
      "Most visitors remember the destination. Locals often remember the walk getting there.",
      prior
    )
  );
});

Deno.test("ensureLastingImpressionClosing replaces weak final paragraphs", () => {
  const body = [
    "South Mountain Preserve opens early for hikers who want cooler air.",
    "Check it out — a great place to spend the day.",
  ];
  const fixed = ensureLastingImpressionClosing(
    body,
    "The scenery changes with the seasons, but the feeling of slowing down here rarely does."
  );
  assertEquals(fixed.at(-1), LASTING_IMPRESSION_EXAMPLES[0]);
});

Deno.test("lastingImpressionClosingForPlace is stable for a seed", () => {
  const a = lastingImpressionClosingForPlace("Desert Botanical Garden", "2026-07-16", "botanical garden");
  const b = lastingImpressionClosingForPlace("Desert Botanical Garden", "2026-07-16", "botanical garden");
  assertEquals(a, b);
  assert(a.length > 24);
});

Deno.test("buildLastingImpressionPromptBlock includes desk guidance", () => {
  const block = buildLastingImpressionPromptBlock("events");
  assert(block.includes("Lasting Impression"));
  assert(block.includes("never a recap"));
});

Deno.test("selectLastingImpressionClosing rotates by seed", () => {
  const a = selectLastingImpressionClosing("2026-07-16", "Trail A");
  const b = selectLastingImpressionClosing("2026-07-17", "Trail A");
  assert(LASTING_IMPRESSION_EXAMPLES.includes(a));
  assert(LASTING_IMPRESSION_EXAMPLES.includes(b));
});
