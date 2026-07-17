import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  passesLastingThoughtTest,
  validateLastingThought,
} from "./memorableWriting.ts";

Deno.test("rejects generic lasting-thought endings", () => {
  assertEquals(
    passesLastingThoughtTest("This artwork is still admired around the world."),
    false
  );
});

Deno.test("accepts specific memorable conclusions", () => {
  assertEquals(
    passesLastingThoughtTest(
      "In 1927 the tower held 20,000 gallons.\n\nNext time you pass the Gilbert Water Tower, remember it once overlooked farmland instead of neighborhoods.",
      { subjectTokens: ["Gilbert", "tower"] }
    ),
    true
  );
});

Deno.test("reports weak conclusion reason", () => {
  assertEquals(
    validateLastingThought(
      "Founded in 1912.\n\nThe city has many parks and schools."
    ).reason,
    "weak_conclusion"
  );
});
