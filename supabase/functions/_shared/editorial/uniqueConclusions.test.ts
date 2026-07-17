import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractLastParagraph,
  passesUniqueConclusionTest,
} from "./uniqueConclusions.ts";

Deno.test("rejects generic masterpiece closings", () => {
  assertEquals(
    passesUniqueConclusionTest(
      "Return to it when you can — and until then, let today's masterpiece slow the morning by a minute or two."
    ),
    false
  );
});

Deno.test("accepts artwork-specific closings", () => {
  assertEquals(
    passesUniqueConclusionTest(
      "Before you leave, look once more at how Monet handles light in the central passage of Water Lilies — that single choice is often what separates a glance from a memory."
    ),
    true
  );
});

Deno.test("extractLastParagraph from multiline body", () => {
  assertEquals(
    extractLastParagraph("One.\n\nTwo.\n\nThree."),
    "Three."
  );
});
