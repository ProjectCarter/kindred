import test from "node:test";
import assert from "node:assert/strict";
import { metroKeyFromPlace } from "../location/metroKey.ts";
import { editionMetroKeyFromPlace } from "./editionIdentity.ts";
import {
  assertLocationMatchesMarket,
  resolveEditionMarket,
} from "./resolveEditionMarket.ts";
import {
  filterLocalEventsByMarket,
  filterPlacesByMarket,
} from "./editionMarketIsolation.ts";
import { assessFamilyFriendlyListing } from "../../supabase/functions/_shared/localEvents/familyFriendlyFilter.ts";

const SAN_DIEGO = {
  city: "San Diego",
  state: "CA",
  lat: 32.7157,
  lon: -117.1611,
};

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

test("San Diego resolves to san-diego-ca market identity", () => {
  const market = resolveEditionMarket(SAN_DIEGO);
  assert.ok(market);
  assert.equal(market.metroKey, "san-diego-ca");
  assert.equal(market.stateCode, "CA");
});

test("Gilbert resolves to phoenix-az metro membership", () => {
  const market = resolveEditionMarket(GILBERT);
  assert.ok(market);
  assert.equal(market.metroKey, "phoenix-az");
  assert.ok(market.metroCities.some((c) => c.toLowerCase() === "gilbert"));
});

test("Seattle resolves to seattle-wa", () => {
  const market = resolveEditionMarket(SEATTLE);
  assert.ok(market);
  assert.equal(market.metroKey, "seattle-wa");
});

test("San Diego cannot return Gilbert or Mesa events", () => {
  const market = resolveEditionMarket(SAN_DIEGO)!;
  const mesaEvent = {
    name: "Buds & Bikinis Pool Party",
    venue: "Golden Hills Golf Club",
    city: "Mesa",
    lat: 33.4152,
    lon: -111.8315,
  };
  const result = filterLocalEventsByMarket([mesaEvent], market, SAN_DIEGO);
  assert.equal(result.kept.length, 0);
  assert.equal(result.rejected.length, 1);
});

test("generated edition removes items outside market radius", () => {
  const market = resolveEditionMarket(SAN_DIEGO)!;
  const laEvent = {
    name: "LA Concert",
    venue: "Hollywood Bowl",
    city: "Los Angeles",
    lat: 34.1122,
    lon: -118.3395,
  };
  const result = filterLocalEventsByMarket([laEvent], market, SAN_DIEGO);
  assert.equal(result.kept.length, 0);
  assert.ok(result.rejected[0]?.reason.includes("outside_market"));
});

test("missing San Diego catalogs do not fall back to Gilbert events", () => {
  const sdMarket = resolveEditionMarket(SAN_DIEGO)!;
  const gilbertMarket = resolveEditionMarket(GILBERT)!;
  assert.notEqual(sdMarket.metroKey, gilbertMarket.metroKey);
  const gilbertEvent = {
    name: "Farmers Market",
    venue: "2270 E Williams Field Rd",
    city: "Gilbert",
    lat: 33.3528,
    lon: -111.789,
  };
  const sdResult = filterLocalEventsByMarket([gilbertEvent], sdMarket, SAN_DIEGO);
  assert.equal(sdResult.kept.length, 0);
});

test("edition cache metro keys isolate Gilbert and San Diego markets", () => {
  const gilbertKey = editionMetroKeyFromPlace(GILBERT);
  const sanDiegoKey = editionMetroKeyFromPlace(SAN_DIEGO);
  assert.equal(gilbertKey, "phoenix-az");
  assert.equal(sanDiegoKey, "san-diego-ca");
  assert.notEqual(gilbertKey, sanDiegoKey);
  assert.equal(metroKeyFromPlace(GILBERT), "gilbert-az");
});

test("San Diego label with Gilbert coordinates is rejected", () => {
  const market = resolveEditionMarket(SAN_DIEGO)!;
  const mismatch = assertLocationMatchesMarket(
    { city: "San Diego", state: "CA", lat: GILBERT.lat, lon: GILBERT.lon },
    market
  );
  assert.equal(mismatch.ok, false);
});

test("adult stripper events are blocked", () => {
  const assessment = assessFamilyFriendlyListing({
    name: "Muscle Men Male Strippers Revue",
    venue: "Downtown Lounge",
    category: "nightlife",
  });
  assert.equal(assessment.excluded, true);
});

test("family-safe community events remain allowed", () => {
  const assessment = assessFamilyFriendlyListing({
    name: "Saturday Farmers Market",
    venue: "Waterfront Park",
    category: "market",
  });
  assert.equal(assessment.excluded, false);
});

test("Phoenix/Gilbert valley events stay inside phoenix-az market", () => {
  const market = resolveEditionMarket(GILBERT)!;
  const chandlerEvent = {
    name: "Art Walk",
    venue: "Downtown Chandler",
    city: "Chandler",
    lat: 33.3062,
    lon: -111.8413,
  };
  const result = filterLocalEventsByMarket([chandlerEvent], market, GILBERT);
  assert.equal(result.kept.length, 1);
});

test("Gilbert-area place with Arizona address passes Gilbert market filter", () => {
  const market = resolveEditionMarket(GILBERT)!;
  const place = {
    name: "Joe's Coffee",
    city: "Gilbert",
    state: "AZ",
    address: "2270 E Williams Field Rd, Gilbert, AZ",
    lat: 33.3528,
    lon: -111.789,
  };
  const result = filterPlacesByMarket([place], market, GILBERT);
  assert.equal(result.kept.length, 1);
});

test("San Diego edition rejects Arizona place addresses", () => {
  const market = resolveEditionMarket(SAN_DIEGO)!;
  const place = {
    name: "Joe's Coffee",
    city: "Gilbert",
    state: "AZ",
    address: "2270 E Williams Field Rd, Gilbert, AZ",
    lat: 33.3528,
    lon: -111.789,
  };
  const result = filterPlacesByMarket([place], market, SAN_DIEGO);
  assert.equal(result.kept.length, 0);
});

test("developer override coordinates resolve San Diego market not Gilbert", () => {
  const market = resolveEditionMarket({
    city: "San Diego",
    state: "CA",
    region: "California",
    lat: 32.7157,
    lon: -117.1611,
  });
  assert.equal(market?.metroKey, "san-diego-ca");
  assert.notEqual(market?.metroKey, "gilbert-az");
});
