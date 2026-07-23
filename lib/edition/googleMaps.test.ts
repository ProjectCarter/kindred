import test from "node:test";
import assert from "node:assert/strict";
import {
  GOOGLE_MAPS_ACTION_LABEL,
  buildGoogleMapsIosAppUrl,
  buildGoogleMapsSearchUrl,
  resolveMapsSearchQuery,
} from "./googleMaps.ts";
import type { MapsDestination } from "./googleMaps.ts";

test("prefers name and address over coordinates", () => {
  const dest: MapsDestination = {
    lat: 33.4484,
    lon: -112.074,
    address: "123 Main St, Gilbert, AZ",
    name: "Desert Botanical Garden",
    city: "Phoenix",
  };
  assert.equal(
    resolveMapsSearchQuery(dest),
    "Desert Botanical Garden, 123 Main St, Gilbert, AZ"
  );
  assert.equal(
    buildGoogleMapsSearchUrl(dest),
    "https://www.google.com/maps/search/?api=1&query=Desert%20Botanical%20Garden%2C%20123%20Main%20St%2C%20Gilbert%2C%20AZ"
  );
});

test("builds Alta Climbing style name plus full address queries", () => {
  const dest: MapsDestination = {
    lat: 33.2478,
    lon: -111.789,
    name: "Alta Climbing and Fitness",
    address: "3193 S Ranch House Pkwy, Gilbert, AZ 85297",
    city: "Gilbert",
    state: "AZ",
  };
  assert.equal(
    resolveMapsSearchQuery(dest),
    "Alta Climbing and Fitness, 3193 S Ranch House Pkwy, Gilbert, AZ 85297"
  );
  assert.equal(
    buildGoogleMapsSearchUrl(dest),
    "https://www.google.com/maps/search/?api=1&query=Alta%20Climbing%20and%20Fitness%2C%203193%20S%20Ranch%20House%20Pkwy%2C%20Gilbert%2C%20AZ%2085297"
  );
});

test("uses name plus city and state when address is absent", () => {
  const dest: MapsDestination = {
    lat: 37.8651,
    lon: -119.5383,
    name: "Yosemite National Park",
    state: "CA",
  };
  assert.equal(resolveMapsSearchQuery(dest), "Yosemite National Park, CA");
});

test("uses verified address when name is absent", () => {
  const dest: MapsDestination = {
    address: "123 Main St, Gilbert, AZ",
    city: "Gilbert",
  };
  assert.equal(resolveMapsSearchQuery(dest), "123 Main St, Gilbert, AZ");
  assert.match(buildGoogleMapsSearchUrl(dest)!, /google.com\/maps\/search/);
  assert.doesNotMatch(buildGoogleMapsSearchUrl(dest)!, /maps.apple.com/);
});

test("falls back to coordinates when no textual location exists", () => {
  const dest: MapsDestination = {
    lat: 33.4484,
    lon: -112.074,
  };
  assert.equal(resolveMapsSearchQuery(dest), "33.4484,-112.074");
  assert.equal(
    buildGoogleMapsSearchUrl(dest),
    "https://www.google.com/maps/search/?api=1&query=33.4484%2C-112.074"
  );
});

test("rejects partial street numbers and falls back to name + city", () => {
  const dest: MapsDestination = {
    address: "1839",
    name: "The Hang Out",
    city: "Gilbert",
    state: "AZ",
  };
  assert.equal(resolveMapsSearchQuery(dest), "The Hang Out, Gilbert, AZ");
});

test("rejects number-only comma addresses", () => {
  const dest: MapsDestination = {
    address: "1839, Gilbert, AZ 85296",
    name: "The Hang Out",
    city: "Gilbert",
    state: "AZ",
  };
  assert.equal(resolveMapsSearchQuery(dest), "The Hang Out, Gilbert, AZ");
});

test("returns null when no verified location exists", () => {
  assert.equal(resolveMapsSearchQuery({ name: "Mystery Place" }), null);
  assert.equal(buildGoogleMapsSearchUrl({}), null);
});

test("builds iOS Google Maps app URLs without Apple Maps schemes", () => {
  const url = buildGoogleMapsIosAppUrl({
    name: "Alta Climbing and Fitness",
    address: "3193 S Ranch House Pkwy, Gilbert, AZ 85297",
  });
  assert.match(url!, /^comgooglemaps:\/\//);
  assert.match(url!, /Alta%20Climbing/);
  assert.doesNotMatch(url!, /maps.apple.com/);
});

test("uses the Google Maps action label constant", () => {
  assert.equal(GOOGLE_MAPS_ACTION_LABEL, "Open in Google Maps");
});
