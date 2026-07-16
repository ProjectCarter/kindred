import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSourceConfidencePromptBlock,
  classifySourceConfidenceLevel,
  containsConfidentHistoricalClaim,
  containsInferenceHedge,
  containsUnsupportedLocalClaim,
  containsUnsupportedSuperlative,
  filterSourceConfidenceParagraphs,
  validateSourceConfidenceText,
} from "./sourceConfidence.ts";

Deno.test("containsInferenceHedge recognizes cautious inference language", () => {
  assert(containsInferenceHedge("The trail is likely quietest early in the morning."));
  assert(!containsInferenceHedge("Built in 1912, the hall still hosts concerts."));
});

Deno.test("validateSourceConfidenceText rejects unsupported local and crowd claims", () => {
  assertEquals(
    validateSourceConfidenceText("Locals love this spot on Saturday mornings.").reason,
    "local_claim"
  );
  assertEquals(
    validateSourceConfidenceText("Expect standing room only most weekends.").reason,
    "crowd"
  );
});

Deno.test("validateSourceConfidenceText rejects unsupported superlatives", () => {
  assertEquals(
    validateSourceConfidenceText("This is the best coffee in town.").reason,
    "superlative"
  );
  assert(
    validateSourceConfidenceText(
      "Listed as a neighborhood favorite on the provider page, it may be worth a stop."
    ).passes
  );
});

Deno.test("containsConfidentHistoricalClaim rejects ungrounded dates", () => {
  assert(
    containsConfidentHistoricalClaim("Built in 1912, the theater anchors the block.")
  );
  assert(
    !containsConfidentHistoricalClaim(
      "Built in 1912, the theater anchors the block.",
      { verifiedHaystack: "Built in 1912 as a vaudeville house." }
    )
  );
});

Deno.test("filterSourceConfidenceParagraphs keeps grounded copy", () => {
  const filtered = filterSourceConfidenceParagraphs([
    "Locals love this place and it is always crowded.",
    "The listing notes free admission on Friday evenings.",
    "Weekday mornings tend to be the calmest window for a short visit.",
  ], { desk: "events" });
  assertEquals(filtered.length, 2);
  assert(filtered.some((p) => p.includes("listing notes")));
});

Deno.test("classifySourceConfidenceLevel maps editorial fact tiers", () => {
  assertEquals(
    classifySourceConfidenceLevel({
      hasVerifiedSource: true,
      hasListingFields: true,
      usesHedgeLanguage: false,
    }),
    "verified"
  );
  assertEquals(
    classifySourceConfidenceLevel({
      hasVerifiedSource: false,
      hasListingFields: false,
      usesHedgeLanguage: true,
    }),
    "inferred"
  );
  assertEquals(
    classifySourceConfidenceLevel({
      hasVerifiedSource: false,
      hasListingFields: false,
      usesHedgeLanguage: false,
    }),
    "unknown"
  );
});

Deno.test("buildSourceConfidencePromptBlock includes desk guidance", () => {
  const block = buildSourceConfidencePromptBlock("history");
  assert(block.includes("Source Confidence"));
  assert(block.includes("grounding data"));
});
