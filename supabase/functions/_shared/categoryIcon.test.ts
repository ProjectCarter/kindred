import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CATEGORY_ICON_DICTIONARY,
  editorialTitleWithIcon,
  resolveEventCategoryIcon,
} from "../../../lib/edition/categoryIcon.ts";

Deno.test("resolveEventCategoryIcon maps theater consistently", () => {
  assertEquals(
    resolveEventCategoryIcon({
      name: "Shakespeare in the Park",
      venue: "Central Park",
      category: "arts",
    }),
    CATEGORY_ICON_DICTIONARY.theater
  );
});

Deno.test("resolveEventCategoryIcon maps farmers market to carrot", () => {
  assertEquals(
    resolveEventCategoryIcon({
      name: "Gilbert Farmers Market",
      venue: "Downtown Gilbert",
      category: "market",
    }),
    CATEGORY_ICON_DICTIONARY.farmers_market
  );
});

Deno.test("brewery with live music uses brewery icon as primary destination", () => {
  assertEquals(
    resolveEventCategoryIcon({
      name: "Live Music at Desert Eagle Brewing",
      venue: "Desert Eagle Brewing",
      category: "music",
    }),
    CATEGORY_ICON_DICTIONARY.brewery
  );
});

Deno.test("comedy uses laughing emoji", () => {
  assertEquals(
    resolveEventCategoryIcon({
      name: "Stand-Up Saturday",
      venue: "The Comedy Club",
      category: "comedy",
    }),
    CATEGORY_ICON_DICTIONARY.comedy
  );
});

Deno.test("editorialTitleWithIcon does not double-prefix or stack", () => {
  assertEquals(
    editorialTitleWithIcon("🎭", "🎭 Shakespeare in the Park"),
    "🎭 Shakespeare in the Park"
  );
  assertEquals(
    editorialTitleWithIcon("🍺", "Desert Eagle Brewing"),
    "🍺 Desert Eagle Brewing"
  );
});
