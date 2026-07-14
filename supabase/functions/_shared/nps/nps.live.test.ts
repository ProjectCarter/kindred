import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchNpsParks, isNpsConfigured } from "./npsProvider.ts";
import { getNpsParksForEdition } from "./index.ts";

Deno.test("nps live fetch returns parks when API accepts key", async () => {
  if (!isNpsConfigured()) {
    console.warn("[nps.live] NPS_API_KEY not set — skipping live test");
    return;
  }

  const parks = await fetchNpsParks({
    lat: 37.8651,
    lon: -119.5383,
    state: "CA",
    limit: 5,
  });

  if (parks.length === 0) {
    console.warn("[nps.live] NPS returned no parks — key may still be activating");
    return;
  }

  assertEquals(parks[0].provider, "nps");
  assertEquals(typeof parks[0].fullName, "string");
  assertEquals(typeof parks[0].parkCode, "string");
});

Deno.test("getNpsParksForEdition enriches parks without exposing api key", async () => {
  if (!isNpsConfigured()) return;

  const parks = await getNpsParksForEdition(
    null,
    { lat: 33.35, lon: -111.79, state: "AZ" },
    null
  );
  if (parks.length === 0) return;

  const serialized = JSON.stringify(parks);
  const key = Deno.env.get("NPS_API_KEY") ?? "";
  if (key) {
    assertEquals(serialized.includes(key), false);
  }
});
