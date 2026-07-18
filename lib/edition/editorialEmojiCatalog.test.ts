/**
 * Editorial emoji catalog — unit tests (deno).
 */

import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
  EDITORIAL_EMOJI,
  resolveEditorialEmojiFromHay,
} from "./editorialEmojiCatalog.ts";
import { resolveEventCategoryIcon } from "./categoryIcon.ts";

Deno.test("taco festival resolves to 🌮", () => {
  assertEquals(resolveEditorialEmojiFromHay("annual taco festival"), EDITORIAL_EMOJI.tacos);
});

Deno.test("block party resolves to 🎉 not 🤝", () => {
  const icon = resolveEventCategoryIcon({
    name: "Summer Block Party",
    venue: "Main Street",
    category: "community",
  });
  assertEquals(icon, EDITORIAL_EMOJI.celebration);
  assertNotEquals(icon, EDITORIAL_EMOJI.community_networking);
});

Deno.test("networking mixer resolves to 🤝", () => {
  assertEquals(
    resolveEventCategoryIcon({
      name: "Startup Networking Mixer",
      venue: "WeWork",
      category: "community",
    }),
    EDITORIAL_EMOJI.community_networking
  );
});

Deno.test("pickleball tournament resolves to 🏓", () => {
  assertEquals(
    resolveEventCategoryIcon({
      name: "City Pickleball Tournament",
      venue: "Community Center",
      category: "sports",
    }),
    EDITORIAL_EMOJI.pickleball
  );
});
