import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEventHighlights } from "./eventHighlights.ts";
import { stripStreetAddresses } from "./detailHero.ts";

test("badges map to benefit-first highlights", () => {
  const out = buildEventHighlights({
    badges: ["free", "food_drinks"],
    category: undefined,
  });
  assert.deepEqual(out, ["Free to attend", "Food and drinks on site"]);
});

test("tickets_required is not a 'why you'll love it' highlight", () => {
  const out = buildEventHighlights({
    badges: ["tickets_required"],
    category: undefined,
  });
  assert.deepEqual(out, []);
});

test("category rounds out the list after badges", () => {
  const out = buildEventHighlights({ badges: ["free"], category: "market" });
  assert.deepEqual(out, ["Free to attend", "Browse local makers and vendors"]);
});

test("category does not duplicate a badge already shown", () => {
  const out = buildEventHighlights({
    badges: ["live_music"],
    category: "music",
  });
  assert.deepEqual(out, ["Live music sets the mood"]);
});

test("category alone still yields a highlight", () => {
  const out = buildEventHighlights({ badges: [], category: "family" });
  assert.deepEqual(out, ["Great for the whole family"]);
});

test("no verified signals yields no invented highlights", () => {
  assert.deepEqual(
    buildEventHighlights({ badges: [], category: undefined }),
    []
  );
  assert.deepEqual(buildEventHighlights({}), []);
});

test("caps at four highlights", () => {
  const out = buildEventHighlights(
    {
      badges: ["free", "live_music", "food_drinks", "dog_friendly", "free_parking"],
      category: "community",
    },
    4
  );
  assert.equal(out.length, 4);
});

test("stripStreetAddresses removes the street but keeps the city", () => {
  assert.equal(
    stripStreetAddresses("Join us at 123 Main St, Phoenix for the festival."),
    "Join us, Phoenix for the festival."
  );
});

test("stripStreetAddresses handles a suite and zip", () => {
  const out = stripStreetAddresses(
    "The market is located at 456 E Elliot Rd, Suite 100, 85234 downtown."
  );
  assert.ok(!/456|Elliot|Suite|85234/.test(out), out);
  assert.ok(/downtown/.test(out), out);
});

test("stripStreetAddresses leaves address-free copy untouched", () => {
  const text = "A lively evening of local music and food trucks.";
  assert.equal(stripStreetAddresses(text), text);
});
