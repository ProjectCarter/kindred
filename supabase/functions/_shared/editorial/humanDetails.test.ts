import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildHumanDetailsPromptBlock,
  containsFabricatedHumanDetail,
  containsGenericPlaceObservation,
  filterHumanDetailParagraphs,
  hasHumanDetailSignal,
  humanDetailObservationForCategory,
  humanDetailObservationForEventCategory,
} from "./humanDetails.ts";

Deno.test("containsGenericPlaceObservation rejects directory praise", () => {
  assert(containsGenericPlaceObservation("A beautiful place perfect for everyone."));
  assert(containsGenericPlaceObservation("This hidden gem is a must visit."));
  assert(!containsGenericPlaceObservation(
    "Morning light reaches the far side of the garden first."
  ));
});

Deno.test("containsFabricatedHumanDetail rejects invented crowd and smell claims", () => {
  assert(containsFabricatedHumanDetail("Everyone loves the back patio here."));
  assert(containsFabricatedHumanDetail("It always smells like fresh bread in the morning."));
  assert(!containsFabricatedHumanDetail(
    "Locals usually arrive before the first hour ends."
  ));
});

Deno.test("hasHumanDetailSignal recognizes subtle observation copy", () => {
  assert(hasHumanDetailSignal("If you pause for a minute, the quieter entrance is on the left."));
  assert(hasHumanDetailSignal("One detail many visitors overlook is how the light shifts after 4 PM."));
  assert(!hasHumanDetailSignal("This is a restaurant in downtown Phoenix."));
});

Deno.test("filterHumanDetailParagraphs keeps grounded observations", () => {
  const filtered = filterHumanDetailParagraphs([
    "A beautiful place and hidden gem for everyone.",
    "Locals usually walk the loop clockwise, when morning light reaches the ridge first.",
    "Everyone says the wait times are perfect.",
  ]);
  assertEquals(filtered.length, 1);
  assert(filtered[0]!.toLowerCase().includes("morning light"));
});

Deno.test("humanDetailObservationForCategory returns category-safe observations", () => {
  const coffee = humanDetailObservationForCategory("coffee shop", "Phoenix");
  assert(coffee);
  assert(hasHumanDetailSignal(coffee));

  const generic = humanDetailObservationForCategory("general place");
  assertEquals(generic, null);
});

Deno.test("humanDetailObservationForEventCategory covers event desks", () => {
  const music = humanDetailObservationForEventCategory("music");
  assert(music);
  assert(hasHumanDetailSignal(music));
});

Deno.test("buildHumanDetailsPromptBlock includes desk guidance", () => {
  const events = buildHumanDetailsPromptBlock("events");
  assert(events.includes("Human Details"));
  assert(events.includes("Never invent crowd size"));

  const history = buildHumanDetailsPromptBlock("history");
  assert(history.includes("grounding data supports them"));
});
