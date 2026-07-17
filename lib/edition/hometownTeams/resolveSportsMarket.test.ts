import test from "node:test";
import assert from "node:assert/strict";
import { resolveSportsMarketId } from "./resolveSportsMarket.ts";

test("Gilbert AZ resolves to Phoenix Metro sports market", () => {
  assert.equal(
    resolveSportsMarketId({ city: "Gilbert", state: "AZ", metroKey: "gilbert-az" }),
    "phoenix-metro"
  );
});

test("Seattle suburbs resolve to Seattle Metro", () => {
  assert.equal(
    resolveSportsMarketId({ city: "Bellevue", state: "WA", metroKey: "bellevue-wa" }),
    "seattle-metro"
  );
});

test("Denver resolves to Denver Metro", () => {
  assert.equal(
    resolveSportsMarketId({ city: "Denver", state: "CO", metroKey: "denver-co" }),
    "denver-metro"
  );
});

test("unknown cities return null sports market", () => {
  assert.equal(resolveSportsMarketId({ city: "Boise", state: "ID" }), null);
});
