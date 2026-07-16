import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyEditionVarietyToBody,
  buildEditionVarietyPromptBlock,
  buildVarietySeed,
  closingLineForVariety,
  orderDiscoverySlots,
  rotateParagraphOrder,
  selectClosingStyle,
  selectOpeningStyle,
} from "./editionVariety.ts";

Deno.test("buildVarietySeed changes when edition date changes", () => {
  const a = buildVarietySeed("2026-07-16", "Jazz at The Nash");
  const b = buildVarietySeed("2026-07-17", "Jazz at The Nash");
  assertNotEquals(a, b);
});

Deno.test("consecutive editions pick different opening and closing styles", () => {
  const item = "Farmers Market Downtown";
  const day1 = buildVarietySeed("2026-07-16", item);
  const day2 = buildVarietySeed("2026-07-17", item);
  const stylesDiffer =
    selectOpeningStyle(day1) !== selectOpeningStyle(day2) ||
    selectClosingStyle(day1) !== selectClosingStyle(day2);
  assert(stylesDiffer);
});

Deno.test("rotateParagraphOrder preserves facts while changing middle order", () => {
  const body = [
    "Alpha opener with enough length.",
    "Beta fact with verified detail.",
    "Gamma detail with local context.",
    "Epsilon note about practical timing.",
    "Delta closing with quiet observation.",
  ];
  const seedA = buildVarietySeed("2026-07-16", "Same Event");
  const seedB = buildVarietySeed("2026-07-17", "Same Event");
  const outA = rotateParagraphOrder(body, seedA, { preserveFirst: true, preserveLast: true });
  const outB = rotateParagraphOrder(body, seedB, { preserveFirst: true, preserveLast: true });
  assertEquals(outA[0], body[0]);
  assertEquals(outA[outA.length - 1], body[body.length - 1]);
  assertEquals([...outA].sort().join("|"), [...body].sort().join("|"));
  assertNotEquals(outA.join("|"), outB.join("|"));
});

Deno.test("applyEditionVarietyToBody reorders frozen event copy by edition", () => {
  const frozen = [
    "The Nash hosts jazz on Friday with a small-room format.",
    "Tickets are listed through Eventbrite.",
    "Doors typically open before the posted set time.",
    "Live music is listed as part of the program.",
  ];
  const a = applyEditionVarietyToBody(frozen, buildVarietySeed("2026-07-16", "Jazz"));
  const b = applyEditionVarietyToBody(frozen, buildVarietySeed("2026-07-17", "Jazz"));
  assertEquals(new Set(a), new Set(frozen));
  assertNotEquals(a.join("\n"), b.join("\n"));
});

Deno.test("orderDiscoverySlots rotates middle blocks by lead profile", () => {
  const slots = orderDiscoverySlots(
    [
      { role: "opening", text: "Open line." },
      { role: "atmosphere", text: "Room rhythm." },
      { role: "why", text: "Why visit." },
      { role: "tips", text: "Check hours." },
      { role: "who", text: "Good for pairs." },
      { role: "closing", text: "Quiet close." },
    ],
    buildVarietySeed("2026-07-16", "Coffee Shop")
  );
  assertEquals(slots[0], "Open line.");
  assertEquals(slots[slots.length - 1], "Quiet close.");
  assert(slots.length >= 4);
});

Deno.test("buildEditionVarietyPromptBlock includes cadence and opening guidance", () => {
  const block = buildEditionVarietyPromptBlock(buildVarietySeed("2026-07-16", "Trail"));
  assert(block.includes("Opening style"));
  assert(block.includes("Vary cadence"));
  assert(block.includes("beautiful"));
});

Deno.test("closingLineForVariety is stable per seed but varies across editions", () => {
  const title = "Desert Botanical Garden";
  const c1 = closingLineForVariety(title, buildVarietySeed("2026-07-16", title));
  const c2 = closingLineForVariety(title, buildVarietySeed("2026-07-17", title));
  assert(c1.length > 20);
  assertNotEquals(c1, c2);
});
