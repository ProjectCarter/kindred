import test from "node:test";
import assert from "node:assert/strict";
import {
  editionIdentityKey,
  editionMetroKeyFromPlace,
  editionsConflictTarget,
} from "./editionIdentity.ts";
import { resolveEditionMarket } from "./resolveEditionMarket.ts";
import { filterEditionSectionRowsByMarket } from "./editionSectionAudit.ts";
import { metroKeyFromPlace } from "../location/metroKey.ts";

const GILBERT = {
  city: "Gilbert",
  state: "AZ",
  lat: 33.3528,
  lon: -111.789,
};

const SEATTLE = {
  city: "Seattle",
  state: "WA",
  lat: 47.6062,
  lon: -122.3321,
};

const SAN_DIEGO = {
  city: "San Diego",
  state: "CA",
  lat: 32.7157,
  lon: -117.1611,
};

test("Gilbert resolves to phoenix-az canonical edition metro_key", () => {
  assert.equal(editionMetroKeyFromPlace(GILBERT), "phoenix-az");
});

test("Seattle and San Diego resolve to distinct canonical metro keys", () => {
  assert.equal(editionMetroKeyFromPlace(SEATTLE), "seattle-wa");
  assert.equal(editionMetroKeyFromPlace(SAN_DIEGO), "san-diego-ca");
  assert.notEqual(
    editionMetroKeyFromPlace(SEATTLE),
    editionMetroKeyFromPlace(SAN_DIEGO)
  );
});

test("same user + same date + different metro_key yields different identity keys", () => {
  const userId = "user-1";
  const date = "2026-07-17";
  const gilbertKey = editionIdentityKey({
    userId,
    editionDate: date,
    metroKey: "phoenix-az",
  });
  const seattleKey = editionIdentityKey({
    userId,
    editionDate: date,
    metroKey: "seattle-wa",
  });
  const sanDiegoKey = editionIdentityKey({
    userId,
    editionDate: date,
    metroKey: "san-diego-ca",
  });
  assert.notEqual(gilbertKey, seattleKey);
  assert.notEqual(seattleKey, sanDiegoKey);
  assert.notEqual(gilbertKey, sanDiegoKey);
});

test("upsert conflict target includes metro_key", () => {
  assert.equal(editionsConflictTarget(), "user_id,edition_date,metro_key");
});

const PHOENIX_VALLEY_CITIES = [
  ["Phoenix", 33.4484, -112.074],
  ["Scottsdale", 33.4942, -111.9261],
  ["Tempe", 33.4255, -111.94],
  ["Mesa", 33.4152, -111.8315],
  ["Chandler", 33.3062, -111.8413],
  ["Gilbert", 33.3528, -111.789],
  ["Glendale", 33.5387, -112.186],
  ["Peoria", 33.5806, -112.2374],
  ["Surprise", 33.6292, -112.3679],
  ["Avondale", 33.4356, -112.3496],
  ["Goodyear", 33.4353, -112.358],
  ["Queen Creek", 33.2487, -111.6343],
  ["Buckeye", 33.3703, -112.5838],
  ["Cave Creek", 33.8334, -111.9508],
  ["Fountain Hills", 33.6117, -111.7174],
  ["Apache Junction", 33.415, -111.5496],
] as const;

for (const [city, lat, lon] of PHOENIX_VALLEY_CITIES) {
  test(`${city} resolves to phoenix-az canonical edition metro_key`, () => {
    const market = resolveEditionMarket({
      city,
      state: "AZ",
      lat,
      lon,
    });
    assert.ok(market, `${city} should resolve to a market`);
    assert.equal(market!.metroKey, "phoenix-az");
    assert.ok(
      market!.metroCities.some((member) => member.toLowerCase() === city.toLowerCase()),
      `${city} should be explicit metro_cities member`
    );
  });
}

test("catalog city slug differs from canonical edition metro for Gilbert", () => {
  assert.equal(metroKeyFromPlace(GILBERT), "gilbert-az");
  assert.equal(editionMetroKeyFromPlace(GILBERT), "phoenix-az");
});

test("cross-market local_events section rejected for Seattle edition", () => {
  const market = resolveEditionMarket(SEATTLE)!;
  const chandlerBody = JSON.stringify({
    events: [{ name: "Chandler Fest", city: "Chandler", venue: "Downtown" }],
  });
  const { rejected } = filterEditionSectionRowsByMarket({
    rows: [
      {
        edition_id: "ed-seattle",
        section_type: "local_events",
        position: 3,
        headline: "Events",
        body: chandlerBody,
      },
    ],
    market,
    catalogMetroKey: "seattle-wa",
    anchor: SEATTLE,
  });
  assert.equal(rejected.length, 1);
});

test("three canonical metro keys can coexist for one user and date", () => {
  const userId = "reader-42";
  const date = "2026-07-17";
  const keys = ["phoenix-az", "seattle-wa", "san-diego-ca"].map((metroKey) =>
    editionIdentityKey({ userId, editionDate: date, metroKey })
  );
  assert.equal(new Set(keys).size, 3);
});

test("Gilbert normal behavior: still resolves Phoenix market membership", () => {
  const market = resolveEditionMarket(GILBERT);
  assert.ok(market);
  assert.equal(market.metroKey, "phoenix-az");
  assert.ok(market.metroCities.some((c) => c.toLowerCase() === "gilbert"));
});
