import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildEditorialIntelligencePromptBlock,
  containsGenericAiPhrase,
  endingReadsLikeSummary,
  filterGenericAiParagraphs,
  hasMemorableTakeaway,
} from "./editorialIntelligence.ts";

Deno.test("containsGenericAiPhrase catches banned directory voice", () => {
  assert(containsGenericAiPhrase("Whether you're a local or visitor, this park is lovely."));
  assert(containsGenericAiPhrase("Nestled in the hills, the trail opens at dawn."));
  assert(!containsGenericAiPhrase("Most locals arrive before 9 AM to avoid the busiest crowds."));
});

Deno.test("filterGenericAiParagraphs drops filler but keeps specific copy", () => {
  const filtered = filterGenericAiParagraphs([
    "Nestled in downtown, this cafe serves espresso.",
    "Spring is when this trail is known for its wildflower blooms.",
  ]);
  assertEquals(filtered.length, 1);
  assert(filtered[0]!.includes("wildflower"));
});

Deno.test("hasMemorableTakeaway requires a concrete signal", () => {
  assert(
    hasMemorableTakeaway(
      "Photographers often prefer visiting shortly after sunrise for softer light."
    )
  );
  assert(!hasMemorableTakeaway("This is a nice place to visit anytime."));
});

Deno.test("endingReadsLikeSummary rejects recap closings", () => {
  assert(endingReadsLikeSummary("In summary, this museum offers a rich history."));
  assert(!endingReadsLikeSummary(
    "Long after the event ends, it's often the conversations afterward that people remember."
  ));
});

Deno.test("buildEditorialIntelligencePromptBlock includes question framework", () => {
  const block = buildEditorialIntelligencePromptBlock();
  assert(block.includes("Why is this actually worth my time?"));
  assert(block.includes("Never fabricate"));
});
